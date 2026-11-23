import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../database/prisma.service'
import { IBPT_FEDERAL_PCT, IBPT_ESTADUAL_PCT } from '../../config/office.config'
import axios from 'axios'
import * as zlib from 'zlib'

// ─── IBPT Service ──────────────────────────────────────────────────────────────
//
// Atualiza alíquotas IBPT semanalmente via ibpt.valraw.com.br (sem autenticação).
//
// Hierarquia de fallback ao consultar:
//   1. ibpt.valraw.com.br  — tabela pública, atualizada semestralmente
//   2. Banco de dados       — último valor salvo com sucesso (nunca vai a zero)
//   3. office.config        — constantes fixas (primeiro boot ou falha total)

@Injectable()
export class IbptService {
  private readonly logger = new Logger(IbptService.name)

  private readonly defaultNcm = process.env.IBPT_NCM ?? '5903'
  private readonly defaultUf  = process.env.IBPT_UF  ?? 'SP'

  // Cache da tabela UF completa (evita download repetido na mesma semana)
  private ufTableCache = new Map<string, { rows: any[]; cachedAt: number }>()
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000

  // Cache por NCM para `getWeightedRatesForItems`
  private readonly ncmCache = new Map<string, { federalPct: number; estadualPct: number; cachedAt: number }>()

  constructor(private prisma: PrismaService) {}

  /**
   * Retorna as alíquotas da empresa.
   * Usa o último valor salvo no banco; se nulo, usa as constantes de office.config.
   */
  async getRates(companyId: string): Promise<{ federalPct: number; estadualPct: number }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ibptFederalPct: true, ibptEstadualPct: true },
    })
    return {
      federalPct:  company?.ibptFederalPct  ? Number(company.ibptFederalPct)  : IBPT_FEDERAL_PCT,
      estadualPct: company?.ibptEstadualPct ? Number(company.ibptEstadualPct) : IBPT_ESTADUAL_PCT,
    }
  }

  /**
   * Busca alíquotas para o NCM padrão da empresa e salva em todas as empresas.
   * Chamado pelo cron semanal e disponível para chamada manual.
   * Se a API pública falhar, mantém os valores atuais no banco (não zera).
   */
  async updateAllCompanies(): Promise<void> {
    const companies = await this.prisma.company.findMany({ select: { id: true, cnpj: true } })
    if (!companies.length) return

    const rates = await this.fetchPublicRate(this.defaultNcm)
    if (!rates) {
      this.logger.warn('IBPT: API pública indisponível — mantendo últimos valores salvos no banco')
      return
    }

    await this.persistRates(companies.map(c => c.id), rates.federalPct, rates.estadualPct)
  }

  /**
   * Atualiza manualmente as alíquotas de uma empresa.
   */
  async setRates(companyId: string, federalPct: number, estadualPct: number): Promise<void> {
    await this.persistRates([companyId], federalPct, estadualPct)
    this.logger.log(`IBPT atualizado manualmente para ${companyId}: federal=${federalPct}% estadual=${estadualPct}%`)
  }

  /**
   * Retorna alíquotas para um NCM específico.
   * Hierarquia: cache em memória → valraw → DB da empresa → office.config
   */
  async getNcmRate(ncm: string, companyId: string): Promise<{ federalPct: number; estadualPct: number }> {
    const key = `${ncm.replace(/\D/g, '')}-${this.defaultUf}`
    const cached = this.ncmCache.get(key)
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return { federalPct: cached.federalPct, estadualPct: cached.estadualPct }
    }

    const rates = await this.fetchPublicRate(ncm) ?? await this.getRates(companyId)
    this.ncmCache.set(key, { ...rates, cachedAt: Date.now() })
    return rates
  }

  /**
   * Calcula alíquotas ponderadas pelo valor dos itens faturáveis da NF.
   */
  async getWeightedRatesForItems(
    items: Array<{ ncm?: string | null; cfop?: string | null; total?: number | string | null }>,
    _cnpj: string,
    companyId: string,
  ): Promise<{ federalPct: number; estadualPct: number }> {
    const fallback = await this.getRates(companyId)

    const NON_BILLING = ['5902','6902','5903','6903','5916','6916','5949','6949','5925','6925','1202','2202','5201','6201','5411','6411']
    const billable = items.filter(i => i.ncm && Number(i.total ?? 0) > 0 && !NON_BILLING.includes(String(i.cfop ?? '')))
    if (!billable.length) return fallback

    const totalValue = billable.reduce((s, i) => s + Number(i.total), 0)
    if (totalValue === 0) return fallback

    const uniqueNcms = [...new Set(billable.map(i => i.ncm!.replace(/\D/g, '')))]
    const ratesByNcm = new Map<string, { federalPct: number; estadualPct: number }>()
    for (const ncm of uniqueNcms) {
      ratesByNcm.set(ncm, await this.getNcmRate(ncm, companyId))
    }

    let fedW = 0, estW = 0
    for (const item of billable) {
      const value = Number(item.total)
      const ncm   = item.ncm!.replace(/\D/g, '')
      const rates = ratesByNcm.get(ncm) ?? fallback
      fedW += value * rates.federalPct
      estW += value * rates.estadualPct
    }

    return { federalPct: fedW / totalValue, estadualPct: estW / totalValue }
  }

  // ── Cron semanal ────────────────────────────────────────────────────────────

  @Cron('0 6 * * 1')
  async handleWeeklyIbptUpdate() {
    this.logger.log('⏰ Cron semanal IBPT...')
    await this.updateAllCompanies()
  }

  // ── Privado: consulta ibpt.valraw.com.br ─────────────────────────────────────

  private async fetchPublicRate(ncm: string): Promise<{ federalPct: number; estadualPct: number } | null> {
    const uf = this.defaultUf

    // Garante que a tabela UF está em cache
    let rows: any[]
    const cached = this.ufTableCache.get(uf)
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      rows = cached.rows
    } else {
      try {
        rows = await this.downloadUfTable(uf)
        if (!rows.length) return null
        this.ufTableCache.set(uf, { rows, cachedAt: Date.now() })
      } catch (err: any) {
        this.logger.warn(`IBPT valraw download falhou: ${err?.message}`)
        return null
      }
    }

    const cleanNcm = ncm.replace(/\D/g, '').padStart(8, '0')
    const row = rows.find((r: any) => {
      const code = String(r.codigo ?? r.ncm ?? '').replace(/\D/g, '').padStart(8, '0')
      return code === cleanNcm
    })
    if (!row) return null

    const federalPct  = Number(row.aliquotaNacionalFederal ?? row.aliquotaNacional ?? 0)
    const estadualPct = Number(row.aliquotaEstadual ?? 0)
    if (!federalPct && !estadualPct) return null

    return { federalPct, estadualPct }
  }

  private async downloadUfTable(uf: string): Promise<any[]> {
    // Descobre a tabela vigente pelo meta endpoint
    let ano     = String(new Date().getFullYear())
    let tableId = `${ano.slice(-2)}.1.G`

    try {
      const { data: meta } = await axios.get('https://ibpt.valraw.com.br/api/meta.json', { timeout: 8_000 })
      const latest = Array.isArray(meta?.versions) ? meta.versions[0] : (meta?.ultimo ?? meta?.latest)
      if (latest?.tabela) tableId = String(latest.tabela)
      if (latest?.ano)    ano     = String(latest.ano)
    } catch {
      this.logger.warn(`IBPT valraw meta.json indisponível — tentando tabela ${tableId}`)
    }

    const url = `https://ibpt.valraw.com.br/api/${ano}/${tableId}/NCM/${uf}.json.gz`
    this.logger.log(`IBPT valraw: baixando tabela ${tableId} NCM/${uf}...`)

    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 25_000 })
    const decompressed = zlib.gunzipSync(Buffer.from(res.data))
    const rows = JSON.parse(decompressed.toString('utf8'))
    this.logger.log(`IBPT valraw: ${rows.length} NCMs carregados (${tableId}/${uf})`)
    return rows
  }

  private async persistRates(companyIds: string[], federalPct: number, estadualPct: number): Promise<void> {
    const now = new Date()
    for (const id of companyIds) {
      await this.prisma.company.update({
        where: { id },
        data: { ibptFederalPct: federalPct, ibptEstadualPct: estadualPct, ibptUpdatedAt: now } as any,
      })
    }
    this.logger.log(`✅ IBPT salvo no banco: federal=${federalPct}% estadual=${estadualPct}%`)
  }
}

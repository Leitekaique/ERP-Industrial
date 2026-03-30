import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../database/prisma.service'
import { IBPT_FEDERAL_PCT, IBPT_ESTADUAL_PCT } from '../../config/office.config'
import axios from 'axios'

// ─── IBPT Service ──────────────────────────────────────────────────────────────
//
// Mantém as alíquotas IBPT atualizadas semanalmente via API iws.ibpt.org.br.
// As alíquotas são salvas por empresa em Company.ibptFederalPct / ibptEstadualPct.
//
// Variáveis de ambiente utilizadas:
//   IBPT_TOKEN   — token da API iws.ibpt.org.br (opcional; sem token, usa defaults)
//   IBPT_NCM     — NCM para consulta (padrão: '5903' — tecidos impregnados)
//   IBPT_UF      — UF para alíquota estadual (padrão: 'SP')
//
// A API retorna por produto:
//   { Aliquota: { Nacional: 13.45, Estadual: 18.0, Municipal: 0, Importado: 0 } }

@Injectable()
export class IbptService {
  private readonly logger = new Logger(IbptService.name)

  // NCM representativo para beneficiamento têxtil / peletização
  private readonly defaultNcm = process.env.IBPT_NCM ?? '5903'
  private readonly defaultUf  = process.env.IBPT_UF  ?? 'SP'

  constructor(private prisma: PrismaService) {}

  /**
   * Retorna as alíquotas IBPT para uma empresa.
   * Usa os valores salvos no banco; se nulos, usa os defaults de office.config.
   */
  async getRates(companyId: string): Promise<{ federalPct: number; estadualPct: number }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ibptFederalPct: true, ibptEstadualPct: true },
    })
    return {
      federalPct: company?.ibptFederalPct ? Number(company.ibptFederalPct) : IBPT_FEDERAL_PCT,
      estadualPct: company?.ibptEstadualPct ? Number(company.ibptEstadualPct) : IBPT_ESTADUAL_PCT,
    }
  }

  /**
   * Busca alíquotas na API IBPT e salva para todas as empresas.
   * Chamado pelo cron semanal e também disponível para chamada manual.
   */
  async updateAllCompanies(): Promise<void> {
    const token = process.env.IBPT_TOKEN
    if (!token) {
      this.logger.warn('IBPT_TOKEN não configurado — atualização automática ignorada. Configure a variável de ambiente IBPT_TOKEN para ativar.')
      return
    }

    let federalPct: number
    let estadualPct: number

    try {
      const companies = await this.prisma.company.findMany({ select: { id: true, cnpj: true } })
      if (!companies.length) return

      // Busca usando CNPJ da primeira empresa (qualquer um serve para consulta de produto)
      const cnpj = companies[0].cnpj.replace(/\D/g, '')
      const url = `https://iws.ibpt.org.br/api/Produtos/${token}/${cnpj}/${this.defaultNcm}/${this.defaultUf}`

      const { data } = await axios.get(url, { timeout: 10_000 })
      federalPct = Number(data?.Aliquota?.Nacional ?? data?.aliquota?.nacional ?? IBPT_FEDERAL_PCT)
      estadualPct = Number(data?.Aliquota?.Estadual ?? data?.aliquota?.estadual ?? IBPT_ESTADUAL_PCT)

      if (!federalPct || !estadualPct) {
        this.logger.warn(`IBPT API retornou alíquotas zeradas — mantendo valores atuais.`)
        return
      }

      const now = new Date()
      for (const company of companies) {
        await this.prisma.company.update({
          where: { id: company.id },
          data: { ibptFederalPct: federalPct, ibptEstadualPct: estadualPct, ibptUpdatedAt: now } as any,
        })
      }

      this.logger.log(`✅ IBPT atualizado: federal=${federalPct}% estadual=${estadualPct}% (NCM ${this.defaultNcm}/${this.defaultUf})`)
    } catch (err: any) {
      this.logger.error(`Falha ao buscar alíquotas IBPT: ${err?.message}`)
    }
  }

  /**
   * Atualiza manualmente as alíquotas de uma empresa específica.
   */
  async setRates(companyId: string, federalPct: number, estadualPct: number): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { ibptFederalPct: federalPct, ibptEstadualPct: estadualPct, ibptUpdatedAt: new Date() } as any,
    })
    this.logger.log(`IBPT atualizado manualmente para empresa ${companyId}: federal=${federalPct}% estadual=${estadualPct}%`)
  }

  // Roda toda segunda-feira às 6h da manhã
  @Cron('0 6 * * 1')
  async handleWeeklyIbptUpdate() {
    this.logger.log('⏰ Cron semanal: atualizando alíquotas IBPT...')
    await this.updateAllCompanies()
  }
}

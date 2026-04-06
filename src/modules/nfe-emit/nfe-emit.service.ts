import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { buildXml, NfeXmlDto, gerarCNF } from './utils/xml-builder'
import { buildDanfePdf, DanfeData } from './utils/danfe-html'
import { signXml, getSefazEnv } from './utils/xml-signer'
import { buildCancelEventXml, buildCceEventXml, signEventXml } from './utils/event-xml-builder'
import { buildCancelPdf, buildCcePdf } from './utils/event-pdf'
import { MailService } from '../mail/mail.service'
import { IbptService } from './ibpt.service'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as forge from 'node-forge'
import axios from 'axios'
import * as xml2js from 'xml2js'
import { Decimal } from '@prisma/client/runtime/library'
import {
  NfeStatus,
  ProcessHistoryType,
  ProcessHistoryStatus,
} from '@prisma/client'
import { EmitNfeDto } from './dto/emit-nfe.dto'
import { CancelNfeDto } from './dto/cancel-nfe.dto'
import { StatusNfeDto } from './dto/status-nfe.dto'
import { CreateDraftFromStockDto } from './dto/create-draft-from-stock.dto'
import { OFFICE_EMAIL, NON_BILLING_CFOPS, IBPT_FEDERAL_PCT, IBPT_ESTADUAL_PCT } from '../../config/office.config'
import { validarCNPJ, validarCPF } from '../../utils/validate-document'

@Injectable()
export class NfeEmitService {
  private readonly logger = new Logger(NfeEmitService.name)

  /** Retorna true para CFOPs que geram cobrança (excluindo retorno/devolução de material do cliente) */
  private isBillableCfop(cfop: string | null | undefined): boolean {
    return !NON_BILLING_CFOPS.includes(String(cfop ?? ''))
  }

  /** Calcula o valor de cobrança baseado nos itens com CFOP cobrável */
  private calcBillingAmount(items: any[]): number | null {
    const billable = items.filter(it => this.isBillableCfop(it.cfop))
    if (billable.length === 0) return null
    return billable.reduce((acc: number, it: any) => acc + Number(it.total ?? 0), 0)
  }

  /** Monta lista de destinatários: email do destinatário + email do escritório */
  private buildRecipientList(primaryEmail: string | null | undefined): string[] {
    const list: string[] = []
    if (primaryEmail) list.push(primaryEmail)
    if (OFFICE_EMAIL && !list.includes(OFFICE_EMAIL)) list.push(OFFICE_EMAIL)
    return list.length > 0 ? list : (OFFICE_EMAIL ? [OFFICE_EMAIL] : [])
  }

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private ibpt: IbptService,
  ) {}

  // ===========================================================
  // ✅ LIST (model Nfe) - usado pelo NfeList novo
  // GET /nfe-emit?tenantId=&companyId=&status=&q=
  // ===========================================================
  async getNextNfeNumber(tenantId: string, companyId: string): Promise<{ nextNumber: number }> {
    const last = await this.prisma.nfe.findFirst({
      where: { tenantId, companyId, series: 1, status: { not: NfeStatus.draft } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    return { nextNumber: (last?.number ?? 0) + 1 }
  }

  async listNfe(q: any) {
    const tenantId = String(q?.tenantId ?? '')
    const companyId = String(q?.companyId ?? '')
    const status = q?.status ? String(q.status) : undefined
    const text = q?.q ? String(q.q).trim() : ''

    if (!tenantId || !companyId) {
      throw new BadRequestException('tenantId e companyId são obrigatórios')
    }

    const where: any = { tenantId, companyId }

    if (status) {
      // valida contra enum (se vier algo inválido, não explode: só ignora)
      if ((Object.values(NfeStatus) as string[]).includes(status)) {
        where.status = status as any
      }
    }

    if (text) {
      // busca simples por transportadora ou número/série ou nome do destinatário
      where.OR = [
        { transportadora: { contains: text, mode: 'insensitive' } },
        // number é Int? então não dá contains diretamente; tentamos parse:
        ...(Number.isFinite(Number(text))
          ? [
              { number: Number(text) },
              { series: Number(text) },
            ]
          : []),
        { customer: { name: { contains: text, mode: 'insensitive' } } },
        { supplier: { name: { contains: text, mode: 'insensitive' } } },
      ]
    }

    const data = await this.prisma.nfe.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, document: true } },
        supplier: { select: { id: true, name: true, document: true } },
        items: { select: { qty: true, kind: true, total: true, cfop: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // resposta já “pronta pro front”
    return data.map(nfe => ({
      id: nfe.id,
      tenantId: nfe.tenantId,
      companyId: nfe.companyId,
      number: nfe.number ?? null,
      series: nfe.series ?? null,
      status: nfe.status,
      totalInvoice: nfe.totalInvoice?.toString?.() ?? String(nfe.totalInvoice ?? 0),
      totalProducts: nfe.totalProducts?.toString?.() ?? String(nfe.totalProducts ?? 0),
      issuedAt: nfe.issuedAt ?? null,
      createdAt: nfe.createdAt,
      transportadora: nfe.transportadora ?? null,
      cnpjTransportadora: nfe.cnpjTransportadora ?? null,
      xmlPath: nfe.xmlPath ?? null,
      weightNet: nfe.weightNet != null ? Number(nfe.weightNet) : null,
      weightGross: nfe.weightGross != null ? Number(nfe.weightGross) : null,
      volumesQty: nfe.volumesQty != null ? Number(nfe.volumesQty) : null,
      // destinatário — retorna objeto e string para compatibilidade com frontend
      customer: nfe.customer ?? null,
      supplier: nfe.supplier ?? null,
      receiver: nfe.customer?.name ?? nfe.supplier?.name ?? null,
      receiverDocument: nfe.customer?.document ?? nfe.supplier?.document ?? null,
      items: nfe.items,
      // valor de cobrança = itens com CFOP cobrável + frete (exclui retorno/devolução do cliente)
      billingAmount: (() => {
        const base = this.calcBillingAmount(nfe.items)
        const frete = Number(nfe.freightValue ?? 0)
        return base !== null ? base + frete : null
      })(),
    }))
  }

  // ===========================================================
  // ✅ GET ONE (model Nfe)
  // GET /nfe-emit/:id?tenantId=&companyId=
  // ===========================================================
  async getNfe(id: string, q: any) {
    const tenantId = String(q?.tenantId ?? '')
    const companyId = String(q?.companyId ?? '')

    if (!tenantId || !companyId) {
      throw new BadRequestException('tenantId e companyId são obrigatórios')
    }

    const nfe = await this.prisma.nfe.findFirst({
      where: { id, tenantId, companyId },
      include: {
        items: true,
        customer: { select: { id: true, name: true, document: true, ie: true, address: true, city: true, state: true, email: true, phone: true, district: true, billingTerms: true } },
        supplier: { select: { id: true, name: true, document: true, ie: true, address: true, city: true, state: true, email: true, phone: true, district: true } },
        company: { select: { id: true, legalName: true, tradeName: true, cnpj: true, ie: true, address: true, number: true, district: true, city: true, cityCode: true, uf: true, zip: true, phone: true, crt: true, icmsSnRate: true } },
      },
    })

    if (!nfe) throw new BadRequestException('NF não encontrada')

    return nfe
  }

  // ===========================================================
  // 🖨️ DANFE PDF
  // GET /nfe-emit/:id/danfe
  // ===========================================================
  async getDanfePdf(id: string, q: { tenantId?: string; companyId?: string }) {
    const nfe = await this.prisma.nfe.findFirst({
      where: { id },
      include: {
        items: true,
        customer: true,
        supplier: true,
        company: { select: { legalName: true, tradeName: true, cnpj: true, ie: true, address: true, number: true, district: true, city: true, cityCode: true, uf: true, zip: true, phone: true, crt: true, icmsSnRate: true } },
      },
    })
    if (!nfe) return null

    const receiver = nfe.customer ?? nfe.supplier
    const emitente = nfe.company as any

    const billingAmount = this.calcBillingAmount(nfe.items ?? [])
    const icmsSnRate = Number((nfe.company as any)?.icmsSnRate ?? 0)
    const ibptRates = await this.ibpt.getRates(nfe.companyId)

    const totalProducts = Number(nfe.totalProducts ?? 0)
    const totalInvoice = Number(nfe.totalInvoice ?? totalProducts)

    // Reconstrói infoAdic com crédito ICMS + IBPT para o DANFE
    const danfeItens = (nfe.items ?? []).map((it: any) => {
      const taxes = it.taxes as any
      const csosn = taxes?.csosn ? String(taxes.csosn) : '400'
      const total = Number(it.total ?? 0)
      const hasCredit = ['101', '201', '900'].includes(csosn)
      const pCredSN = hasCredit ? icmsSnRate : 0
      const vCredICMSSN = hasCredit ? parseFloat((total * pCredSN / 100).toFixed(2)) : 0
      return { impostos: { icms: { csosn, valor: vCredICMSSN } } }
    })
    const billingBase = billingAmount ?? totalInvoice
    const totalNFComFrete = totalInvoice + Number((nfe as any).freightValue ?? 0)
    const bodyInfoAdic = this.buildInfoAdic(danfeItens, icmsSnRate, undefined, billingBase > 0 ? billingBase : undefined, (nfe as any).refNFe ?? undefined, ibptRates, 'pdf') as any
    const danfeLines = [
      'I. DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL',
      'II. NAO GERA DIREITO A CREDITO FISCAL DE IPI',
      ...(bodyInfoAdic?.top ? [bodyInfoAdic.top] : []),
    ]
    const danfeInfoAdic = danfeLines.join('\n')
    const danfeInfoAdicBottom: string | undefined = bodyInfoAdic?.bottom ?? undefined

    // Parse chave from xmlPath filename or from sefazProtocol
    const chaveMatch = nfe.xmlPath?.match(/(\d{44})/)
    const chaveAcesso = chaveMatch ? chaveMatch[1] : undefined

    const modFreteMap: Record<string, string> = {
      EMITENTE: '0', DESTINATARIO: '1', TERCEIROS: '2', SEM_FRETE: '9',
    }

    // Detecta tpAmb lendo do XML salvo (mais confiável que sefazProtocol, que é null em NFs rejeitadas)
    let tpAmb: '1' | '2' = '2'
    if (nfe.xmlPath) {
      try {
        const absXml = path.resolve(nfe.xmlPath)
        if (fs.existsSync(absXml)) {
          const xmlRaw = fs.readFileSync(absXml, 'utf-8')
          tpAmb = xmlRaw.includes('<tpAmb>1</tpAmb>') ? '1' : '2'
        }
      } catch { /* mantém '2' se falhar */ }
    }

    // Build duplicatas from billingTerms if available
    const dupList: { numero: string; vencimento: string; valor: number }[] = []
    if ((receiver as any)?.billingTerms && totalInvoice > 0) {
      const terms = (receiver as any).billingTerms as string
      const dupVal = (billingAmount ?? totalInvoice) + Number((nfe as any).freightValue ?? 0)
      const installments = this.parseInstallments(terms, new Date(nfe.issuedAt ?? nfe.createdAt), dupVal)
      if (installments) {
        installments.forEach((inst, i) => {
          dupList.push({
            numero: String(i + 1).padStart(3, '0'),
            vencimento: inst.dueDate.toLocaleDateString('pt-BR'),
            valor: inst.amount.toNumber(),
          })
        })
      } else {
        const due = this.computeDueDateFromBillingTerms(new Date(nfe.issuedAt ?? nfe.createdAt), terms)
        dupList.push({ numero: '001', vencimento: due.toLocaleDateString('pt-BR'), valor: dupVal })
      }
    }

    const data: DanfeData = {
      number: nfe.number ?? '',
      series: nfe.series ?? 1,
      chaveAcesso,
      naturezaOperacao: nfe.naturezaOperacao ?? 'Prestacao de servico de beneficiamento',
      issuedAt: nfe.issuedAt ?? nfe.createdAt,
      tpAmb,
      protocol: nfe.sefazProtocol ?? null,

      emitNome: emitente?.legalName ?? '',
      emitFantasia: emitente?.tradeName ?? undefined,
      emitCnpj: emitente?.cnpj ?? '',
      emitIe: emitente?.ie ?? undefined,
      emitEndereco: emitente?.address ?? '',
      emitNumero: (emitente as any)?.number ?? undefined,
      emitBairro: (emitente as any)?.district ?? undefined,
      emitCidade: emitente?.city ?? '',
      emitUF: emitente?.uf ?? '',
      emitCep: emitente?.zip ?? undefined,
      emitFone: emitente?.phone ?? undefined,
      emitEmail: emitente?.email ?? undefined,
      emitCrt: '1',

      destNome: receiver?.name ?? '',
      destCnpj: receiver?.document ?? '',
      destIe: (receiver as any)?.ie ?? undefined,
      destEndereco: receiver?.address ?? '',
      destBairro: (receiver as any)?.district ?? (receiver as any)?.neighborhood ?? undefined,
      destCidade: receiver?.city ?? '',
      destUF: (receiver as any)?.state ?? (receiver as any)?.uf ?? '',
      destCep: (receiver as any)?.zip ?? undefined,
      destFone: (receiver as any)?.phone ?? undefined,
      destEmail: receiver?.email ?? undefined,

      faturaNumero: nfe.number ? String(nfe.number).padStart(9, '0') : undefined,
      faturaValorOriginal: (billingAmount ?? totalInvoice) + Number((nfe as any).freightValue ?? 0),
      faturaValorDesconto: 0,
      faturaValorLiquido: (billingAmount ?? totalInvoice) + Number((nfe as any).freightValue ?? 0),
      duplicatas: dupList.length > 0 ? dupList : undefined,

      items: (nfe.items ?? []).map((it: any, i: number) => {
        const taxes = (it.taxes as any) ?? {}
        return {
          seq: i + 1,
          codigo: it.sku ?? '',
          descricao: it.description ?? '',
          ncm: it.ncm ?? '',
          csosn: taxes?.csosn ?? taxes?.icms?.csosn ?? '',
          cfop: it.cfop ?? '',
          unit: it.unit ?? '',
          qty: Number(it.qty ?? 0),
          unitPrice: Number(it.unitPrice ?? 0),
          discount: 0,
          total: Number(it.total ?? 0),
          baseIcms: 0,
          valorIcms: 0,
          valorIpi: 0,
          aliqIcms: 0,
          aliqIpi: 0,
          kind: it.kind ?? 'BASE',
        }
      }),

      totalProdutos: totalProducts,
      totalFrete: Number((nfe as any).freightValue ?? 0),
      totalNF: totalInvoice + Number((nfe as any).freightValue ?? 0),
      billingAmount,

      modFrete: modFreteMap[(nfe as any).freightPayer ?? ''] ?? '1',
      transportadora: nfe.transportadora ?? undefined,
      cnpjTransportadora: nfe.cnpjTransportadora ?? undefined,
      ieTransportadora: (nfe as any).ieTransportadora ?? undefined,
      endTransportadora: (nfe as any).endTransportadora ?? undefined,
      municipioTransportadora: (nfe as any).municipioTransportadora ?? undefined,
      ufTransportadora: (nfe as any).ufTransportadora ?? undefined,
      vehiclePlate: (nfe as any).vehiclePlate ?? undefined,
      vehicleUf: (nfe as any).vehicleUf ?? undefined,
      volumesQty: (nfe as any).volumesQty ? Number((nfe as any).volumesQty) : undefined,
      volumesSpecies: (nfe as any).volumesSpecies ?? undefined,
      volumesMarca: (nfe as any).volumesBrand ?? undefined,
      weightNet: (nfe as any).weightNet ? Number((nfe as any).weightNet) : undefined,
      weightGross: (nfe as any).weightGross ? Number((nfe as any).weightGross) : undefined,

      valorAproxTributos: billingBase * (ibptRates.federalPct + ibptRates.estadualPct) / 100,
      pctAproxTributos: totalNFComFrete > 0
        ? parseFloat(((billingBase * (ibptRates.federalPct + ibptRates.estadualPct) / 100) / totalNFComFrete * 100).toFixed(2))
        : ibptRates.federalPct + ibptRates.estadualPct,

      infoAdic: danfeInfoAdic,
      infoAdicBottom: danfeInfoAdicBottom,
    }

    return buildDanfePdf(data)
  }

  // ===========================================================
  // ⬇️ DOWNLOAD XML
  // GET /nfe-emit/:id/xml
  // ===========================================================
  async getXmlContent(id: string, q: { tenantId?: string; companyId?: string }) {
    const nfe = await this.prisma.nfe.findFirst({
      where: { id },
      select: { xmlPath: true, number: true, series: true },
    })
    if (!nfe?.xmlPath) return null
    const absPath = path.resolve(nfe.xmlPath)
    if (!fs.existsSync(absPath)) return null
    const content = fs.readFileSync(absPath, 'utf-8')
    // Extrai chave de acesso de 44 dígitos do atributo Id do XML
    const chaveMatch = content.match(/Id="NFe(\d{44})"/)
    const chave = chaveMatch?.[1]
    const filename = chave ? `${chave}.xml` : `nfe-${nfe.number ?? id}.xml`
    return { content, filename }
  }

  // ===========================================================
  // ✅ EMITIR A PARTIR DO DRAFT (model Nfe)
  // POST /nfe-emit/:id/emit
  // Body: { tenantId, companyId, naturezaOperacao? }
  // ===========================================================
  async emitFromDraft(id: string, dto: {
    tenantId: string; companyId: string
    naturezaOperacao?: string
    transportadoraNome?: string; transportadoraCnpj?: string
    freightType?: string; vehiclePlate?: string; vehicleUf?: string
    volumesQty?: string; volumesSpecies?: string; volumesBrand?: string
    weightNet?: string; weightGross?: string
    freteValor?: number
    refNFe?: string
  }) {
    const tenantId = String(dto?.tenantId ?? '')
    const companyId = String(dto?.companyId ?? '')

    if (!tenantId || !companyId) {
      throw new BadRequestException('tenantId e companyId são obrigatórios')
    }

    // Carrega NF + itens + destinatário + company (com campos de certificado)
    const nfe = await this.prisma.nfe.findFirst({
      where: { id, tenantId, companyId },
      include: {
        items: true,
        customer: true,
        supplier: true,
        company: {
          select: {
            id: true, legalName: true, tradeName: true, cnpj: true,
            ie: true, address: true, number: true, district: true,
            city: true, cityCode: true, uf: true, zip: true, phone: true,
            crt: true, icmsSnRate: true,
            certA1Keystore: true, certA1Password: true,
          },
        },
      },
    })

    if (!nfe) throw new BadRequestException('NF não encontrada')
    if (nfe.status !== NfeStatus.draft) {
      throw new BadRequestException(`NF não está em draft (status atual: ${nfe.status})`)
    }
    if (!nfe.items?.length) throw new BadRequestException('NF draft sem itens')

    // ── C.3: Valida campos obrigatórios do destinatário para emissão ─────────
    if (nfe.customer) {
      const missing: string[] = []
      if (!nfe.customer.document) {
        missing.push('CNPJ/CPF')
      } else {
        // A3: valida dígito verificador do CNPJ/CPF
        const doc = nfe.customer.document.replace(/\D/g, '')
        if (doc.length === 14 && !validarCNPJ(doc)) {
          throw new BadRequestException(
            `CNPJ do cliente inválido (dígito verificador incorreto): ${nfe.customer.document}. ` +
            `Acesse Clientes > editar e corrija o CNPJ.`,
          )
        } else if (doc.length === 11 && !validarCPF(doc)) {
          throw new BadRequestException(
            `CPF do cliente inválido (dígito verificador incorreto): ${nfe.customer.document}. ` +
            `Acesse Clientes > editar e corrija o CPF.`,
          )
        }
      }
      if (!nfe.customer.address) missing.push('Endereço')
      if (!nfe.customer.city) missing.push('Cidade')
      if (!nfe.customer.state) missing.push('UF')
      if (!nfe.customer.zip) missing.push('CEP')
      if (!nfe.customer.cityCode) missing.push('Código IBGE do município')
      if (missing.length > 0) {
        throw new BadRequestException(
          `Cliente com cadastro incompleto — campos obrigatórios faltando: ${missing.join(', ')}. ` +
          `Acesse Clientes > editar e preencha antes de emitir a NF.`,
        )
      }
    }

    // ── Persiste campos completados no draft detail antes de emitir ──────────
    const updateData: any = {}
    if (dto.naturezaOperacao?.trim()) updateData.naturezaOperacao = dto.naturezaOperacao.trim()
    if (dto.transportadoraNome?.trim()) updateData.transportadora = dto.transportadoraNome.trim()
    if (dto.transportadoraCnpj?.trim()) {
      updateData.cnpjTransportadora = dto.transportadoraCnpj.trim()
      // Busca dados completos da transportadora pelo CNPJ para preencher endereço no DANFE
      const carrier = await this.prisma.transporter.findFirst({
        where: { cnpj: dto.transportadoraCnpj.trim().replace(/\D/g, '') },
      }).catch(() => null) ?? await this.prisma.transporter.findFirst({
        where: { cnpj: dto.transportadoraCnpj.trim() },
      }).catch(() => null)
      if (carrier) {
        if (carrier.name) updateData.transportadora = carrier.name
        if ((carrier as any).ie) updateData.ieTransportadora = (carrier as any).ie
        const addr = [carrier.address, carrier.number].filter(Boolean).join(', ')
        if (addr) updateData.endTransportadora = addr
        if (carrier.city) updateData.municipioTransportadora = carrier.city
        if (carrier.state) updateData.ufTransportadora = carrier.state
      }
    }
    // freightType → freightPayer enum (mapeamento dos valores do frontend)
    const freightMap: Record<string, string> = {
      destinatario: 'DESTINATARIO', remetente: 'EMITENTE',
      terceiros: 'TERCEIROS', sem_frete: 'SEM_FRETE',
    }
    if (dto.freightType?.trim()) updateData.freightPayer = freightMap[dto.freightType.trim()] ?? 'DESTINATARIO'
    if (dto.vehiclePlate?.trim()) updateData.vehiclePlate = dto.vehiclePlate.trim()
    if (dto.vehicleUf?.trim()) updateData.vehicleUf = dto.vehicleUf.trim()
    if (dto.volumesQty) updateData.volumesQty = Number(dto.volumesQty)
    if (dto.volumesSpecies?.trim()) updateData.volumesSpecies = dto.volumesSpecies.trim()
    if (dto.volumesBrand?.trim()) updateData.volumesBrand = dto.volumesBrand.trim()
    if (dto.weightNet) updateData.weightNet = new Decimal(dto.weightNet)
    if (dto.weightGross) updateData.weightGross = new Decimal(dto.weightGross)
    if (dto.refNFe?.trim()) updateData.refNFe = dto.refNFe.trim()
    if (Object.keys(updateData).length) {
      await this.prisma.nfe.update({ where: { id: nfe.id }, data: updateData })
      Object.assign(nfe, updateData)
    }

    // ── Determina o próximo número sequencial da NF (atômico via transaction) ──
    // Usa SELECT FOR UPDATE para evitar race condition em emissões simultâneas.
    const [nextNumResult] = await this.prisma.$queryRaw<{ next: number }[]>`
      SELECT COALESCE(MAX(number), 0) + 1 AS next
      FROM "Nfe"
      WHERE "tenantId" = ${tenantId}
        AND "companyId" = ${companyId}
        AND series = 1
        AND status != 'draft'
    `
    const nextNfeNumber = Number(nextNumResult.next)

    // ── Carrega o certificado digital ─────────────────────────────────────────
    // Prioridade: banco de dados (certA1Keystore) → arquivo local → modo simulador
    const sefazMode = getSefazEnv()
    let certBuffer: Buffer | null = null
    let certPassword = ''

    if (sefazMode !== 'simulator') {
      if (nfe.company.certA1Keystore) {
        // Certificado armazenado no banco (campo Bytes → Buffer)
        certBuffer = Buffer.from(nfe.company.certA1Keystore)
        certPassword = nfe.company.certA1Password ?? ''
        this.logger.log('🔐 Certificado carregado do banco de dados')
      } else {
        // Fallback: arquivo local (para quando ainda não foi feito upload)
        const certPath = path.resolve('certs/tapajos-cert.pfx')
        if (fs.existsSync(certPath)) {
          certBuffer = fs.readFileSync(certPath)
          certPassword = process.env.CERT_PASSWORD || ''
          this.logger.log('🔐 Certificado carregado de arquivo local')
        }
      }

      if (!certBuffer) {
        throw new BadRequestException(
          'Certificado digital não encontrado. ' +
          'Faça o upload do certificado A1 no cadastro da empresa, ou coloque o arquivo em certs/tapajos-cert.pfx'
        )
      }
    }

    // ── Define o ambiente (tpAmb) baseado no SEFAZ_ENV ───────────────────────
    // homologação = '2', produção = '1', simulador = '2' (estrutura válida mas sem envio)
    const tpAmb: '1' | '2' = sefazMode === 'producao' ? '1' : '2'

    // ── Persiste cNFCode se ainda não gerado (chave imutável entre tentativas) ─
    if (!(nfe as any).cNFCode) {
      const newCNF = gerarCNF()
      await this.prisma.nfe.update({ where: { id: nfe.id }, data: { cNFCode: newCNF } as any })
      ;(nfe as any).cNFCode = newCNF
    }

    // ── Gera e assina o XML ───────────────────────────────────────────────────
    const ibptRatesForEmit = await this.ibpt.getRates(nfe.companyId)
    const emitDto = this.buildEmitDtoFromDraft(nfe, nextNfeNumber, tpAmb, dto.freteValor ?? 0, ibptRatesForEmit)
    const xml = buildXml(emitDto)
    const signedXml = signXml(xml, certBuffer ?? Buffer.alloc(0), certPassword)

    // ── Envia ao SEFAZ (real ou simulado) ────────────────────────────────────
    const response = await this.callSefaz(signedXml, certBuffer, certPassword)

    // ── Extrai o número da NF do XML gerado ──────────────────────────────────
    const numeroNF = this.extractNumeroNF(xml)

    // ── Salva o XML assinado em disco ─────────────────────────────────────────
    // Nome do arquivo usa a chave de acesso (44 dígitos) para que o DANFE a extraia corretamente
    const dir = path.resolve('uploads/nfe_emitidas')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const chaveMatch = signedXml.match(/Id="NFe(\d{44})"/)
    const xmlFilename = chaveMatch ? `${chaveMatch[1]}.xml` : `${numeroNF}.xml`
    const xmlPath = path.join(dir, xmlFilename)
    fs.writeFileSync(xmlPath, signedXml)

    // ── Mapeia cStat para status interno ─────────────────────────────────────
    // 100 e 150 = autorizado, 204 = duplicidade (tratar como autorizado)
    const autorizados = ['100', '150', '204']
    const nextStatus = autorizados.includes(response.cStat)
      ? NfeStatus.authorized
      : response.cStat === 'SIMULADO'
      ? NfeStatus.authorized  // simulador sempre "autoriza"
      : NfeStatus.error

    // ── Atualiza o registro da NF no banco ────────────────────────────────────
    const updated = await this.prisma.nfe.update({
      where: { id: nfe.id },
      data: {
        number: nextNfeNumber,
        series: 1,
        status: nextStatus,
        xmlPath: xmlPath.replace(/\\/g, '/'),
        sefazProtocol: response.nProt ?? null,
        sefazMsg: response.xMotivo ?? null,
        issuedAt: new Date(),
        freightValue: dto.freteValor ? new Decimal(dto.freteValor) : null,
      },
      include: { items: true },
    })

    // ── Auto-cria/atualiza Receivable quando NF é autorizada para um cliente ──
    // Só cria se: (1) foi autorizada e (2) o destinatário é um cliente (venda)
    if (nextStatus === NfeStatus.authorized && nfe.customerId) {
      const issueDate = new Date()
      const billingTerms = (nfe.customer as any)?.billingTerms ?? null

      // Valor a receber = soma dos itens com CFOP cobrável + frete emitente (se houver)
      const cfopBilling = this.calcBillingAmount(updated.items ?? [])
      const freteAmt = dto.freteValor ?? 0
      const nfeAmount = cfopBilling !== null
        ? new Decimal(cfopBilling).add(freteAmt)
        : new Decimal(updated.totalInvoice ?? 0).add(freteAmt)
      const dueDate = this.computeDueDateFromBillingTerms(issueDate, billingTerms)

      const isMonthly = billingTerms === 'dia15' || billingTerms === 'dia20'
      const installments = this.parseInstallments(billingTerms, issueDate, nfeAmount.toNumber())

      if (installments) {
        // Parcelas: cria N receivables com vencimentos e valores individuais
        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i]
          await this.prisma.receivable.create({
            data: {
              tenantId, companyId,
              customerId: nfe.customerId,
              nfeId: updated.id,
              nfeNumbers: String(updated.number ?? ''),
              dueDate: inst.dueDate,
              amount: inst.amount,
              status: 'open' as any,
            } as any,
          })
        }
        this.logger.log(`💰 ${installments.length} parcelas criadas (${billingTerms}) — NF ${updated.number} — total ${nfeAmount}`)
      } else if (isMonthly) {
        // Para acúmulo mensal: busca receivable aberto deste cliente no mesmo mês de vencimento
        const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1)
        const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59)
        // Só acumula em receivable que ainda NÃO foi incluído em fatura (billingId: null)
        const existing = await this.prisma.receivable.findFirst({
          where: {
            tenantId, companyId, customerId: nfe.customerId,
            status: 'open' as any,
            billingId: null,
            dueDate: { gte: startOfMonth, lte: endOfMonth },
          },
        })
        const nfNumStr = String(updated.number ?? '')
        if (existing) {
          const newAmount = new Decimal(existing.amount).add(nfeAmount)
          const prevNums = (existing as any).nfeNumbers ?? ''
          const alreadyHas = prevNums.split(',').map((s: string) => s.trim()).includes(nfNumStr)
          const newNfeNumbers = alreadyHas ? prevNums : (prevNums ? `${prevNums}, ${nfNumStr}` : nfNumStr)
          await this.prisma.receivable.update({
            where: { id: existing.id },
            data: { amount: newAmount, nfeNumbers: newNfeNumbers } as any,
          })
          this.logger.log(`💰 Receivable acumulado (${billingTerms}) — cliente ${nfe.customerId} — NFs: ${newNfeNumbers} — total ${newAmount}`)
        } else {
          // Nenhum receivable em aberto sem fatura para este mês: cria um novo
          await this.prisma.receivable.create({
            data: {
              tenantId, companyId,
              customerId: nfe.customerId,
              nfeId: updated.id,
              nfeNumbers: nfNumStr,
              dueDate,
              amount: nfeAmount,
              status: 'open' as any,
            } as any,
          })
          this.logger.log(`💰 Receivable mensal criado (${billingTerms}) — vencimento ${dueDate.toISOString().slice(0, 10)}`)
        }
      } else {
        // Para termos por NF: cria um receivable por emissão
        await this.prisma.receivable.create({
          data: {
            tenantId, companyId,
            customerId: nfe.customerId,
            nfeId: updated.id,
            nfeNumbers: String(updated.number ?? ''),
            dueDate,
            amount: nfeAmount,
            status: 'open' as any,
          } as any,
        })
        this.logger.log(`💰 Receivable por NF criado (${billingTerms}) — vencimento ${dueDate.toISOString().slice(0, 10)}`)
      }
    }

    // ── Registra no histórico de processos ────────────────────────────────────
    await this.prisma.processHistory.create({
      data: {
        tenantId,
        companyId,
        empresaId: companyId,
        type: ProcessHistoryType.NF_EMITIDA,
        status: ProcessHistoryStatus.APPLIED,
        nfSaidaId: updated.id,
        reference: `NF nº ${nextNfeNumber} emitida — ${sefazMode} — cStat=${response.cStat}`,
        processSnapshot: {
          nfeId: updated.id,
          number: updated.number,
          series: updated.series,
          status: nextStatus,
          sefazMode,
          cStat: response.cStat,
          xMotivo: response.xMotivo,
          nProt: response.nProt,
          recipient: {
            tipo: updated.customerId ? 'CUSTOMER' : 'SUPPLIER',
            id: updated.customerId ?? updated.supplierId ?? null,
            name: (nfe.customer?.name ?? nfe.supplier?.name) ?? null,
          },
        },
      },
    })

    const modeLabel = sefazMode === 'simulator' ? 'simulação' : sefazMode
    this.logger.log(`✅ NF nº ${nextNfeNumber} emitida (${modeLabel}) — cStat=${response.cStat} — ${response.xMotivo}`)

    // G.3 — envia DANFE + XML por e-mail apenas quando autorizada em produção
    // Não envia em homologação (evita confusão com clientes) nem em erro
    if (autorizados.includes(response.cStat) && sefazMode === 'producao') {
      this.sendNfeEmail(updated.id, signedXml, nextNfeNumber).catch(err =>
        this.logger.error(`❌ Falha ao enviar e-mail da NF ${nextNfeNumber}: ${err?.message}`)
      )
    }

    return {
      message: `NF emitida com sucesso (${modeLabel})`,
      nfeId: updated.id,
      number: updated.number,
      status: updated.status,
      cStat: response.cStat,
      xMotivo: response.xMotivo,
      nProt: response.nProt,
      sefazMode,
    }
  }

  // ── G.3: Envia DANFE (PDF) + XML por e-mail após emissão ───────────────────
  private async sendNfeEmail(nfeId: string, xmlContent: string, nfeNumber: number | string) {
    const [danfePdf, nfe] = await Promise.all([
      this.getDanfePdf(nfeId, {}),
      this.prisma.nfe.findUnique({
        where: { id: nfeId },
        include: {
          customer: { select: { name: true, email: true } },
          supplier: { select: { name: true, email: true } },
          company: { select: { tradeName: true, legalName: true, email: true, phone: true } },
        },
      }),
    ])

    if (!danfePdf || !nfe) return

    const numFmt = String(nfeNumber).padStart(9, '0')
    const destNome = nfe.customer?.name ?? nfe.supplier?.name ?? 'Cliente'
    const emitNome = nfe.company?.tradeName || nfe.company?.legalName || 'Tapajós'

    const recipientEmail = nfe.customer?.email ?? nfe.supplier?.email ?? null
    const toList = this.buildRecipientList(recipientEmail)

    // Monta URLs de consulta SEFAZ
    const chave = nfe.xmlPath?.match(/(\d{44})/)?.[1] ?? nfe.sefazProtocol ?? ''
    const urlNacional = chave
      ? `http://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8pl8=&nfe=${chave}`
      : 'http://www.nfe.fazenda.gov.br/portal'
    const urlSP = 'http://www.fazenda.sp.gov.br/nfe/'
    const emitEmail = nfe.company?.email ?? ''
    const emitFone = nfe.company?.phone ?? ''

    await this.mail.sendMail({
      to: toList,
      subject: `NF-e ${numFmt} — ${destNome} — ${emitNome}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;font-size:14px;line-height:1.6">
<p>Em anexo arquivos contendo a nota fiscal eletrônica original (xml e DANFE em pdf), juntamente com seu protocolo de autorização (xml recibo/protocolo) de uso emitido pela SEFAZ.</p>
<p>Conforme determinação da legislação, você deve validar o DANFE correspondente a este arquivo na SEFAZ que autorizou a nf-e correspondente, ou no site da Receita Federal em:</p>
<p><a href="${urlNacional}">${urlNacional}</a><br/><a href="${urlSP}">${urlSP}</a></p>
<p>Atenciosamente,</p>
<p><strong>PELETIZACAO TEXTIL TAPAJOS LTDA - ME</strong><br/>${emitEmail}${emitFone ? '<br/>' + emitFone : ''}</p>
</div>`,
      attachments: [
        {
          filename: `danfe-${numFmt}.pdf`,
          content: danfePdf,
          contentType: 'application/pdf',
        },
        {
          filename: `nfe-${numFmt}.xml`,
          content: Buffer.from(xmlContent, 'utf-8'),
          contentType: 'application/xml',
        },
      ],
    })

    this.logger.log(`📧 NF ${numFmt} — e-mail enviado para ${toList.join(', ')}`)
  }

  // ===========================================================
  // ✅ (MANTÉM SEU FLUXO ATUAL) — EMIT (simulador/offline) LEGADO
  // ===========================================================
  async emitNfe(dto: EmitNfeDto) {
    this.logger.log(`🧩 Emitindo NF-e simulada para ${dto?.cliente?.nome}`)

    const xml = buildXml(dto)

    let certBuffer: Buffer | null = null
    const password = process.env.CERT_PASSWORD || ''
    const certPath = path.resolve('certs/tapajos-cert.pfx')
    if (getSefazEnv() !== 'simulator' && fs.existsSync(certPath)) {
      certBuffer = fs.readFileSync(certPath)
    }
    const signedXml = signXml(xml, certBuffer ?? Buffer.alloc(0), password)

    const response = await this.callSefaz(signedXml, certBuffer, password)
    const numeroNF = this.extractNumeroNF(xml)

    const status = ['100', '150', 'SIMULADO'].includes(response.cStat) ? 'Autorizada' : 'Erro'

    const dir = path.resolve('uploads/nfe_emitidas')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const xmlPath = path.join(dir, `${numeroNF}.xml`)
    fs.writeFileSync(xmlPath, signedXml)

    await this.prisma.nfeEmit.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        numeroNF: String(numeroNF),
        xmlPath: xmlPath.replace(/\\/g, '/'),
        valorTotal: dto.totalNFe ?? dto.totalProdutos ?? 0,
        destinatario: dto.cliente.nome,
        transportadora: dto?.transporte?.transportadora ?? null,
        cnpjTransportadora: dto?.transporte?.cnpj ?? null,
        status,
      },
    })

    this.logger.log(`✅ NF-e simulada emitida com número ${numeroNF} e status ${status}`)
    return { message: 'NF-e emitida (simulação)', numeroNF, status }
  }

  // ===========================================================
  // ✅ CANCEL (simulador) LEGADO
  // ===========================================================
  async cancelNfe(dto: CancelNfeDto) {
    const nfe = await this.prisma.nfeEmit.findFirst({
      where: { numeroNF: String(dto.numeroNF) },
    })
    if (!nfe) throw new BadRequestException('NF-e não encontrada para cancelamento.')

    await this.prisma.nfeEmit.update({
      where: { id: nfe.id },
      data: { status: 'Cancelada' },
    })

    this.logger.log(`🚫 NF-e ${dto.numeroNF} cancelada.`)
    return { message: 'NF-e cancelada com sucesso', numeroNF: dto.numeroNF }
  }

  // ===========================================================
  // ✅ STATUS (simulador) LEGADO
  // ===========================================================
  async statusNfe(dto: StatusNfeDto) {
    const nfe = await this.prisma.nfeEmit.findFirst({
      where: { numeroNF: String(dto.numeroNF) },
    })
    if (!nfe) throw new BadRequestException('NF-e não encontrada.')

    return {
      numeroNF: nfe.numeroNF,
      status: nfe.status,
      dataEmissao: nfe.dataEmissao,
    }
  }

  // ===========================================================
  // DELETE DRAFT
  // ===========================================================
  // ===========================================================
  // a31 — IMPORTAR XML HISTÓRICO (NF emitida já autorizada)
  // POST /nfe-emit/import-xml
  // ===========================================================
  async importHistoricalXml(
    file: Express.Multer.File,
    tenantId: string,
    companyId: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo XML não enviado.')

    const xmlContent = fs.readFileSync(file.path, 'utf-8')
    const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false })

    const infNFe =
      parsed?.nfeProc?.NFe?.infNFe ??
      parsed?.NFe?.infNFe ??
      parsed?.procNFe?.NFe?.infNFe ??
      null

    if (!infNFe) throw new BadRequestException('Estrutura XML de NF-e não reconhecida.')

    const ide = infNFe.ide
    const emit = infNFe.emit
    const dest = infNFe.dest
    const total = infNFe.total?.ICMSTot

    const nfeNumber = ide?.nNF ? parseInt(ide.nNF, 10) : null
    const nfeSeries = ide?.serie ? parseInt(ide.serie, 10) : 1
    const issuedAt = ide?.dhEmi ? new Date(ide.dhEmi) : new Date()
    const naturezaOperacao = ide?.natOp ?? null

    const accessKey = (infNFe['$']?.Id ?? '').replace('NFe', '')
    const protocol = parsed?.nfeProc?.protNFe?.infProt?.nProt ?? null

    // Verifica se já existe NF com esse número/série
    const existing = await this.prisma.nfe.findFirst({
      where: { tenantId, companyId, number: nfeNumber ?? undefined, series: nfeSeries },
    })
    if (existing) throw new BadRequestException(`NF ${nfeSeries}/${nfeNumber} já existe no sistema.`)

    // Tenta encontrar o cliente pelo CNPJ do destinatário
    const destCnpj = dest?.CNPJ ?? dest?.CPF ?? null
    let customerId: string | null = null
    if (destCnpj) {
      const customer = await this.prisma.customer.findFirst({
        where: { tenantId, companyId, document: destCnpj },
      })
      customerId = customer?.id ?? null
    }

    const totalInvoice = total?.vNF ? Number(total.vNF) : 0
    const totalProducts = total?.vProd ? Number(total.vProd) : 0

    // Salva XML no disco — usa chave de acesso como nome de arquivo (padrão SEFAZ)
    const xmlFilename = accessKey ? `${accessKey}.xml` : `historico-${nfeSeries}-${nfeNumber}-${Date.now()}.xml`
    const xmlPath = path.join('./uploads', xmlFilename)
    fs.writeFileSync(xmlPath, xmlContent)

    // Cria o Nfe
    const nfe = await this.prisma.nfe.create({
      data: {
        tenantId,
        companyId,
        customerId,
        number: nfeNumber,
        series: nfeSeries,
        status: 'authorized' as any,
        issuedAt,
        naturezaOperacao,
        totalInvoice: totalInvoice as any,
        totalProducts: totalProducts as any,
        sefazProtocol: protocol,
        xmlPath,
        destRazaoSocial: dest?.xNome ?? null,
        destCnpjCpf: destCnpj,
        emitRazaoSocial: emit?.xNome ?? emit?.xFant ?? null,
        emitCnpj: emit?.CNPJ ?? null,
      },
    })

    // Cria itens
    const detList = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : [])
    for (const det of detList) {
      const prod = det.prod
      if (!prod) continue
      const cfop = prod.CFOP ?? null
      // Classifica kind por CFOP: 5xxx = PMO (serviço/MO), 1xxx = entrada não aplicável
      const kind = cfop && String(cfop).startsWith('5') ? 'PMO' : 'BASE'
      const cest = prod.CEST ?? null
      const imposto = det.imposto
      const csosn =
        imposto?.ICMSSN102?.CSOSN ?? imposto?.ICMSSN400?.CSOSN ??
        imposto?.ICMSSN500?.CSOSN ?? imposto?.ICMSSN900?.CSOSN ?? null
      await this.prisma.nfeItem.create({
        data: {
          nfeId: nfe.id,
          sku: prod.cProd ?? null,
          description: prod.xProd ?? '',
          cfop,
          ncm: prod.NCM ?? null,
          qty: Number(prod.qCom ?? 1) as any,
          unit: prod.uCom ?? 'UN',
          unitPrice: Number(prod.vUnCom ?? 0) as any,
          total: Number(prod.vProd ?? 0) as any,
          kind,
          taxes: {
            ...(csosn ? { csosn } : {}),
            ...(cest ? { cest } : {}),
          },
        },
      })
    }

    this.logger.log(`✅ NF histórica importada: ${nfeSeries}/${nfeNumber} — ${naturezaOperacao}`)
    return { id: nfe.id, number: nfeNumber, series: nfeSeries, issuedAt, totalInvoice }
  }

  async deleteDraft(id: string) {
    const nfe = await this.prisma.nfe.findUnique({ where: { id } })
    if (!nfe) throw new BadRequestException('NF-e não encontrada.')
    if (nfe.status !== 'draft') throw new BadRequestException('Somente rascunhos podem ser excluídos.')
    await this.prisma.nfe.delete({ where: { id } })
    return { message: 'Rascunho excluído com sucesso.' }
  }

  // ===========================================================
  // CANCEL NF (model Nfe) — envia evento evCancNFe ao SEFAZ
  // ===========================================================
  async cancelNfeById(id: string, justificativa?: string) {
    const nfe = await this.prisma.nfe.findUnique({ where: { id }, include: { company: true } })
    if (!nfe) throw new BadRequestException('NF-e não encontrada.')
    if (nfe.status !== 'authorized') throw new BadRequestException('Somente NFs autorizadas podem ser canceladas.')

    const issuedAt = nfe.issuedAt ? new Date(nfe.issuedAt) : null
    if (issuedAt) {
      const hoursElapsed = (Date.now() - issuedAt.getTime()) / (1000 * 60 * 60)
      if (hoursElapsed > 24) throw new BadRequestException('Prazo de 24h para cancelamento expirado.')
    }

    const xJust = justificativa?.trim() ?? 'Cancelamento solicitado pelo emitente'
    if (xJust.length < 15) throw new BadRequestException('Justificativa deve ter pelo menos 15 caracteres.')
    if (xJust.length > 255) throw new BadRequestException('Justificativa deve ter no máximo 255 caracteres.')

    // Extrai chave de acesso (44 dígitos) do xmlPath ou sefazProtocol
    const chaveMatch =
      nfe.xmlPath?.match(/(\d{44})/) ?? nfe.sefazProtocol?.match(/(\d{44})/)
    const chNFe = chaveMatch ? chaveMatch[1] : '0'.repeat(44)

    const cnpjEmitente = nfe.emitCnpj ?? nfe.company?.cnpj ?? ''
    const nProt = nfe.sefazProtocol?.match(/\d{15}/)
      ? (nfe.sefazProtocol.match(/\d{15}/) as RegExpMatchArray)[0]
      : (nfe.sefazProtocol ?? '000000000000000')

    const tpAmb: '1' | '2' = getSefazEnv() === 'producao' ? '1' : '2'

    // Constrói e assina o XML do evento
    const rawXml = buildCancelEventXml({ cnpjEmitente, chNFe, nProt, xJust, tpAmb })
    const signedXml = signEventXml(rawXml)

    // Salva XML no disco
    const eventDir = path.resolve('uploads/nfe_eventos')
    if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir, { recursive: true })
    const xmlFileName = `cancel-nfe${nfe.number ?? id}-${Date.now()}.xml`
    const xmlFilePath = path.join(eventDir, xmlFileName)
    fs.writeFileSync(xmlFilePath, signedXml)

    // Registra o evento no BD (xmlPath dentro do payload)
    const evento = await this.prisma.nfeEvent.create({
      data: {
        nfeId: id,
        type: 'cancel',
        payload: {
          xJust, chNFe, nProt, tpAmb,
          xmlPath: xmlFilePath.replace(/\\/g, '/'),
          nfeNumber: nfe.number,
          emitCnpj: cnpjEmitente,
          emitNome: nfe.emitRazaoSocial,
          destNome: nfe.destRazaoSocial,
          destCnpj: nfe.destCnpjCpf,
          issuedAt: nfe.issuedAt,
        },
        protocol: getSefazEnv() === 'simulator' ? 'SIMULADO' : null,
        status: getSefazEnv() === 'simulator' ? 'simulated' : 'pending',
      },
    })

    // Atualiza status da NF
    await this.prisma.nfe.update({ where: { id }, data: { status: 'canceled' } })

    this.logger.log(`NF-e ${nfe.number} cancelada (evento ${evento.id})`)

    // Envia e-mail com PDF + XML do cancelamento
    this.enviarEmailEvento(evento.id).catch(err =>
      this.logger.warn(`E-mail cancelamento falhou: ${err?.message ?? err}`)
    )

    return {
      message: 'NF-e cancelada com sucesso.',
      eventoId: evento.id,
      ambiente: tpAmb === '1' ? 'Produção' : 'Homologação',
      status: evento.status,
    }
  }

  // ===========================================================
  // CC-e — Carta de Correção Eletrônica
  // ===========================================================
  async emitirCCe(id: string, xCorrecao: string) {
    const nfe = await this.prisma.nfe.findUnique({ where: { id }, include: { company: true, events: true } })
    if (!nfe) throw new BadRequestException('NF-e não encontrada.')
    if (nfe.status !== 'authorized') throw new BadRequestException('Somente NFs autorizadas aceitam CC-e.')

    const correcaoTrimmed = xCorrecao.trim()
    if (correcaoTrimmed.length < 15) throw new BadRequestException('Texto da correção deve ter pelo menos 15 caracteres.')
    if (correcaoTrimmed.length > 1000) throw new BadRequestException('Texto da correção deve ter no máximo 1000 caracteres.')

    // Determina o próximo número de sequência
    const cceAnteriores = nfe.events.filter((e: any) => e.type === 'cce').length
    const nSeqEvento = cceAnteriores + 1
    if (nSeqEvento > 20) throw new BadRequestException('Limite de 20 CC-es por NF-e atingido.')

    // Extrai chave de acesso
    const chaveMatch =
      nfe.xmlPath?.match(/(\d{44})/) ?? nfe.sefazProtocol?.match(/(\d{44})/)
    const chNFe = chaveMatch ? chaveMatch[1] : '0'.repeat(44)

    const cnpjEmitente = nfe.emitCnpj ?? nfe.company?.cnpj ?? ''
    const tpAmb: '1' | '2' = getSefazEnv() === 'producao' ? '1' : '2'

    // Constrói e assina o XML do evento
    const rawXml = buildCceEventXml({ cnpjEmitente, chNFe, xCorrecao: correcaoTrimmed, tpAmb, nSeqEvento })
    const signedXml = signEventXml(rawXml)

    // Salva XML no disco
    const eventDir = path.resolve('uploads/nfe_eventos')
    if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir, { recursive: true })
    const xmlFileName = `cce-nfe${nfe.number ?? id}-seq${nSeqEvento}-${Date.now()}.xml`
    const xmlFilePath = path.join(eventDir, xmlFileName)
    fs.writeFileSync(xmlFilePath, signedXml)

    // Registra o evento (xmlPath dentro do payload)
    const evento = await this.prisma.nfeEvent.create({
      data: {
        nfeId: id,
        type: 'cce',
        payload: {
          xCorrecao: correcaoTrimmed, chNFe, nSeqEvento, tpAmb,
          xmlPath: xmlFilePath.replace(/\\/g, '/'),
          nfeNumber: nfe.number,
          emitCnpj: cnpjEmitente,
          emitNome: nfe.emitRazaoSocial,
          destNome: nfe.destRazaoSocial,
          destCnpj: nfe.destCnpjCpf,
          issuedAt: nfe.issuedAt,
        },
        protocol: getSefazEnv() === 'simulator' ? 'SIMULADO' : null,
        status: getSefazEnv() === 'simulator' ? 'simulated' : 'pending',
      },
    })

    this.logger.log(`CC-e nº ${nSeqEvento} emitida para NF ${nfe.number} (evento ${evento.id})`)

    // Envia e-mail com PDF + XML da CC-e
    this.enviarEmailEvento(evento.id).catch(err =>
      this.logger.warn(`E-mail CC-e falhou: ${err?.message ?? err}`)
    )

    return {
      message: `Carta de Correção nº ${nSeqEvento} registrada com sucesso.`,
      eventoId: evento.id,
      nSeqEvento,
      ambiente: tpAmb === '1' ? 'Produção' : 'Homologação',
      status: evento.status,
    }
  }

  // ===========================================================
  // Lista eventos de uma NF
  // ===========================================================
  async listEventos(nfeId: string) {
    return this.prisma.nfeEvent.findMany({
      where: { nfeId },
      orderBy: { createdAt: 'asc' },
    })
  }

  // ===========================================================
  // Download XML de evento
  // ===========================================================
  async getEventoXml(eventoId: string): Promise<{ content: string; filename: string } | null> {
    const evento = await this.prisma.nfeEvent.findUnique({ where: { id: eventoId } })
    if (!evento) return null
    const payload = evento.payload as any
    const xmlPath = payload?.xmlPath
    if (!xmlPath || !fs.existsSync(path.resolve(xmlPath))) return null
    const content = fs.readFileSync(path.resolve(xmlPath), 'utf-8')
    const typePrefix = evento.type === 'cancel' ? 'cancel' : 'cce'
    const nfeNum = payload?.nfeNumber ?? eventoId
    return { content, filename: `${typePrefix}-nfe${nfeNum}.xml` }
  }

  // ===========================================================
  // Download PDF de evento
  // ===========================================================
  async getEventoPdf(eventoId: string): Promise<{ buffer: Buffer; filename: string } | null> {
    const evento = await this.prisma.nfeEvent.findUnique({ where: { id: eventoId } })
    if (!evento) return null
    const payload = evento.payload as any

    if (evento.type === 'cancel') {
      const buffer = await buildCancelPdf({
        nfeNumber: payload?.nfeNumber,
        issuedAt: payload?.issuedAt,
        canceledAt: evento.createdAt,
        chNFe: payload?.chNFe,
        nProt: payload?.nProt ?? '-',
        xJust: payload?.xJust ?? '-',
        protocol: evento.protocol,
        status: evento.status,
        tpAmb: payload?.tpAmb,
        emitNome: payload?.emitNome,
        emitCnpj: payload?.emitCnpj,
        destNome: payload?.destNome,
        destCnpj: payload?.destCnpj,
      })
      return { buffer, filename: `cancel-nfe${payload?.nfeNumber ?? eventoId}.pdf` }
    }

    if (evento.type === 'cce') {
      const buffer = await buildCcePdf({
        nfeNumber: payload?.nfeNumber,
        issuedAt: payload?.issuedAt,
        cceAt: evento.createdAt,
        chNFe: payload?.chNFe,
        nSeqEvento: payload?.nSeqEvento ?? 1,
        xCorrecao: payload?.xCorrecao ?? '-',
        protocol: evento.protocol,
        status: evento.status,
        tpAmb: payload?.tpAmb,
        emitNome: payload?.emitNome,
        emitCnpj: payload?.emitCnpj,
        destNome: payload?.destNome,
        destCnpj: payload?.destCnpj,
      })
      return { buffer, filename: `cce-nfe${payload?.nfeNumber ?? eventoId}-seq${payload?.nSeqEvento ?? 1}.pdf` }
    }

    return null
  }

  // ===========================================================
  // Envia e-mail de cancelamento / CC-e
  // ===========================================================
  private async sendEventoEmail(
    eventoId: string,
    nfe: any,
    pdfBuffer: Buffer,
    xmlContent: string,
    pdfFilename: string,
    xmlFilename: string,
    subject: string,
    bodyHtml: string,
  ) {
    const recipientEmail = (nfe as any)?.customer?.email ?? (nfe as any)?.supplier?.email ?? null
    const toList = this.buildRecipientList(recipientEmail)

    await this.mail.sendMail({
      to: toList,
      subject,
      html: bodyHtml,
      attachments: [
        { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
        { filename: xmlFilename, content: Buffer.from(xmlContent, 'utf-8'), contentType: 'application/xml' },
      ],
    })
    this.logger.log(`📧 Evento ${eventoId} — e-mail enviado para ${toList.join(', ')}`)
  }

  // ===========================================================
  // Envia e-mail para evento criado (cancelamento ou CC-e)
  // ===========================================================
  async enviarEmailEvento(eventoId: string) {
    const evento = await this.prisma.nfeEvent.findUnique({
      where: { id: eventoId },
      include: { nfe: { include: { customer: true, supplier: true, company: true } } },
    })
    if (!evento) throw new BadRequestException('Evento não encontrado.')

    const payload = evento.payload as any
    const nfe = evento.nfe as any

    // Gera PDF e lê XML
    const pdfResult = await this.getEventoPdf(eventoId)
    const xmlResult = await this.getEventoXml(eventoId)

    if (!pdfResult || !xmlResult) {
      throw new BadRequestException('Arquivos do evento não encontrados. Gere o evento novamente.')
    }

    const numFmt = String(payload?.nfeNumber ?? '-')
    const destNome = payload?.destNome ?? nfe.customer?.name ?? nfe.supplier?.name ?? 'Destinatário'
    const emitNome = payload?.emitNome ?? (nfe.company?.tradeName || 'Tapajós')

    if (evento.type === 'cancel') {
      await this.sendEventoEmail(
        eventoId,
        nfe,
        pdfResult.buffer,
        xmlResult.content,
        pdfResult.filename,
        xmlResult.filename,
        `Cancelamento NF-e ${numFmt} — ${destNome} — ${emitNome}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#dc2626">Cancelamento de NF-e</h2>
<p>A NF-e nº <strong>${numFmt}</strong> emitida por <strong>${emitNome}</strong> para <strong>${destNome}</strong> foi <strong>cancelada</strong>.</p>
<ul>
  <li><strong>Justificativa:</strong> ${payload?.xJust ?? '-'}</li>
  <li><strong>Data do cancelamento:</strong> ${new Date(evento.createdAt).toLocaleDateString('pt-BR')}</li>
</ul>
<p>O comprovante de cancelamento (PDF) e o XML do evento estão em anexo.</p>
<p style="color:#888;font-size:12px">Gerado automaticamente pelo ERP Tapajós.</p>
</div>`,
      )
    } else if (evento.type === 'cce') {
      await this.sendEventoEmail(
        eventoId,
        nfe,
        pdfResult.buffer,
        xmlResult.content,
        pdfResult.filename,
        xmlResult.filename,
        `Carta de Correção (CC-e) nº ${payload?.nSeqEvento} — NF-e ${numFmt} — ${emitNome}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#d97706">Carta de Correção Eletrônica — CC-e</h2>
<p>Foi emitida a Carta de Correção nº <strong>${payload?.nSeqEvento}</strong> para a NF-e <strong>${numFmt}</strong> de <strong>${emitNome}</strong> para <strong>${destNome}</strong>.</p>
<ul>
  <li><strong>Correção:</strong> ${payload?.xCorrecao ?? '-'}</li>
  <li><strong>Data de emissão:</strong> ${new Date(evento.createdAt).toLocaleDateString('pt-BR')}</li>
</ul>
<p>A CC-e (PDF) e o XML do evento estão em anexo.</p>
<p style="color:#888;font-size:12px">Gerado automaticamente pelo ERP Tapajós.</p>
</div>`,
      )
    }

    return { message: 'E-mail enviado com sucesso.' }
  }

  // ===========================================================
  // ETAPA A — PREVIEW FROM STOCK (wizard)
  // ===========================================================
  async previewFromStock(params: { tenantId: string; companyId: string; stockLotIds: string[] }) {
    const { tenantId, companyId, stockLotIds } = params
    if (!stockLotIds?.length) throw new BadRequestException('Nenhum item selecionado')

    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new BadRequestException('Company inválida (seed?)')

    const lots = await this.prisma.stockLot.findMany({
      where: { tenantId, companyId, id: { in: stockLotIds } },
      include: { product: true, warehouse: true },
    })
    if (!lots.length) throw new BadRequestException('Nenhum lote encontrado')

    const [customers, suppliers] = await Promise.all([
      this.prisma.customer.findMany({ where: { tenantId, companyId }, orderBy: { name: 'asc' } }),
      this.prisma.supplier.findMany({ where: { tenantId, companyId }, orderBy: { name: 'asc' } }),
    ])

    const warnings: string[] = []
    const pmoBySku = new Map<string, any>()

    const items: Array<{
      productId?: string | null
      sku?: string | null
      description: string
      cfop?: string | null
      ncm?: string | null
      qty: number
      unit?: string | null
      unitPrice: number
      total: number
      taxes?: any
      csosn?: string | null
      meta?: any
    }> = []

    for (const lot of lots) {
      const p = lot.product
      const qty = Number(lot.qtyRemaining)
      const unit = lot.unit ?? p.unit ?? null

      const baseUnitPrice = Number(p.price)
      const baseTaxes = p.taxes ?? null
      const baseCsosn = this.getCsosnFromTaxes(baseTaxes)

      items.push({
        productId: p.id,
        sku: p.sku ?? null,
        description: p.name,
        cfop: p.cfop ?? null,
        ncm: p.ncm ?? null,
        qty,
        unit,
        unitPrice: baseUnitPrice,
        total: qty * baseUnitPrice,
        taxes: baseTaxes,
        csosn: baseCsosn,
        meta: { lotId: lot.id, kind: 'BASE', sku: p.sku },
      })

      const isPF = !!p.customerId && p.empresaId === p.customerId
      if (isPF) {
        let pmo = pmoBySku.get(p.sku)
        if (!pmo) {
          pmo = await this.prisma.product.findFirst({
            where: { tenantId, companyId, sku: p.sku, empresaId: companyId },
          })
          if (pmo) pmoBySku.set(p.sku, pmo)
        }

        if (!pmo) {
          warnings.push(`PMO não encontrado para SKU ${p.sku} (empresaId=Tapajós).`)
        } else {
          const pmoUnitPrice = Number(pmo.price)
          const pmoTaxes = pmo.taxes ?? null
          const pmoCsosn = this.getCsosnFromTaxes(pmoTaxes)

          items.push({
            productId: pmo.id,
            sku: pmo.sku ?? null,
            description: pmo.name,
            cfop: pmo.cfop ?? null,
            ncm: pmo.ncm ?? null,
            qty,
            unit,
            unitPrice: pmoUnitPrice,
            total: qty * pmoUnitPrice,
            taxes: pmoTaxes,
            csosn: pmoCsosn,
            meta: { lotId: lot.id, kind: 'PMO', sku: p.sku, baseProductId: p.id },
          })
        }
      }
    }

    const totalProducts = items.reduce((acc, it) => acc + (it.total || 0), 0)

    const customerIds = new Set(lots.map(l => l.product.customerId).filter(Boolean) as string[])
    const supplierIds = new Set(lots.map(l => l.product.supplierId).filter(Boolean) as string[])

    let defaultRecipient: any = null
    if (customerIds.size === 1) {
      const id = Array.from(customerIds)[0]
      const c = customers.find(x => x.id === id)
      if (c) defaultRecipient = { tipo: 'CUSTOMER', id: c.id, nome: c.name, document: c.document }
    } else if (supplierIds.size === 1) {
      const id = Array.from(supplierIds)[0]
      const s = suppliers.find(x => x.id === id)
      if (s) defaultRecipient = { tipo: 'SUPPLIER', id: s.id, nome: s.name, document: s.document }
    }

    return {
      emitente: {
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName ?? null,
        cnpj: company.cnpj,
        ie: company.ie ?? null,
        address: company.address ?? null,
      },
      defaultRecipient,
      recipients: {
        customers: customers.map(c => ({ id: c.id, nome: c.name, document: c.document })),
        suppliers: suppliers.map(s => ({ id: s.id, nome: s.name, document: s.document })),
      },
      items,
      totals: { totalProducts },
      warnings,
    }
  }

  // ===========================================================
  // ETAPA B — CREATE DRAFT (Nfe + NfeItem) + baixa por lote (ATÔMICO)
  // ===========================================================
  async createDraftFromStock(dto: CreateDraftFromStockDto) {
    const { tenantId, companyId } = dto

    if (!dto?.items?.length) throw new BadRequestException('Sem itens para emitir')
    if (!dto?.recipient?.id) throw new BadRequestException('Destinatário não informado')

    const recipientTipo = dto.recipient.tipo
    if (recipientTipo !== 'CUSTOMER' && recipientTipo !== 'SUPPLIER') {
      throw new BadRequestException('Tipo de destinatário inválido')
    }

    const [customer, supplier] = await Promise.all([
      recipientTipo === 'CUSTOMER'
        ? this.prisma.customer.findFirst({ where: { id: dto.recipient.id, tenantId, companyId } })
        : Promise.resolve(null),
      recipientTipo === 'SUPPLIER'
        ? this.prisma.supplier.findFirst({ where: { id: dto.recipient.id, tenantId, companyId } })
        : Promise.resolve(null),
    ])

    if (recipientTipo === 'CUSTOMER' && !customer) throw new BadRequestException('Customer inválido')
    if (recipientTipo === 'SUPPLIER' && !supplier) throw new BadRequestException('Supplier inválido')

    const itemsPrepared = dto.items.map((it: any) => {
      const qty = new Decimal(it.qty ?? 0)
      const unitPrice = new Decimal(it.unitPrice ?? 0)
      const total = new Decimal(qty.mul(unitPrice).toFixed(2))

      return {
        productId: it.productId ?? null,
        sku: it.sku ?? it?.meta?.sku ?? null,
        description: it.description ?? '',
        cfop: it.cfop ?? null,
        ncm: it.ncm ?? null,
        qty,
        unit: it.unit ?? null,
        unitPrice,
        total,
        taxes: it.taxes ?? null,
        __meta: it.meta ?? null,
      }
    })

    const totalProducts = itemsPrepared.reduce(
      (acc: Decimal, it: any) => acc.add(it.total),
      new Decimal(0),
    )

    const baseConsumptions = dto.items
      .filter((it: any) => (it?.meta?.kind ?? 'BASE') === 'BASE')
      .map((it: any) => ({
        lotId: String(it?.meta?.lotId ?? ''),
        qty: new Decimal(it.qty ?? 0),
        unit: it.unit ?? null,
        sku: it.sku ?? it?.meta?.sku ?? null,
        productId: it.productId ?? null,
      }))

    for (const c of baseConsumptions) {
      if (!c.lotId) throw new BadRequestException('Item BASE sem meta.lotId (não dá para baixar o lote)')
      if (c.qty.lte(0)) throw new BadRequestException('Quantidade inválida em item BASE')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const nfe = await tx.nfe.create({
        data: {
          tenantId,
          companyId,
          customerId: recipientTipo === 'CUSTOMER' ? customer!.id : null,
          supplierId: recipientTipo === 'SUPPLIER' ? supplier!.id : null,

          status: NfeStatus.draft,

          totalProducts,
          totalTax: new Decimal(0),
          totalInvoice: totalProducts,

          transportadora: dto?.transportadora?.nome ?? null,
          cnpjTransportadora: dto?.transportadora?.cnpj ?? null,

          items: {
            create: itemsPrepared.map((it: any) => ({
              productId: it.productId ?? null,
              sku: it.sku ?? null,
              description: it.description,
              cfop: it.cfop ?? null,
              ncm: it.ncm ?? null,
              qty: it.qty,
              unit: it.unit ?? null,
              unitPrice: it.unitPrice,
              total: it.total,
              taxes: it.taxes ?? null,
              kind: it.__meta?.kind ?? 'BASE',
            })),
          },
        },
        include: { items: true },
      })

      const lotIds = baseConsumptions.map(x => x.lotId)
      const lots = await tx.stockLot.findMany({
        where: { tenantId, companyId, id: { in: lotIds } },
        select: {
          id: true,
          productId: true,
          warehouseId: true,
          qtyRemaining: true,
          unit: true,
          processo: true,
          empresaId: true,
        },
      })

      if (lots.length !== lotIds.length) {
        const found = new Set(lots.map(l => l.id))
        const missing = lotIds.filter(x => !found.has(x))
        throw new BadRequestException(`Lote(s) não encontrado(s): ${missing.join(', ')}`)
      }

      const lotById = new Map(lots.map(l => [l.id, l]))

      for (const c of baseConsumptions) {
        const lot = lotById.get(c.lotId)!
        const available = new Decimal(lot.qtyRemaining as any)

        if (available.lt(c.qty)) {
          throw new BadRequestException(
            `Estoque insuficiente no lote ${lot.id}. Disponível=${available.toString()} Solicitado=${c.qty.toString()}`,
          )
        }

        await tx.stockLot.update({
          where: { id: lot.id },
          data: { qtyRemaining: { decrement: c.qty as any } },
        })

        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            companyId,
            warehouseId: lot.warehouseId,
            productId: lot.productId,
            type: 'out',
            qty: c.qty as any,
            ownership: 'own',
            occurredAt: new Date(),
            reference: `NF_DRAFT:${nfe.id}`,
            note: `Baixa por criação de NF (draft) - lote ${lot.id}`,
            customerId: recipientTipo === 'CUSTOMER' ? customer!.id : null,
            supplierId: recipientTipo === 'SUPPLIER' ? supplier!.id : null,
            pairId: nfe.id,
          },
        })

        await tx.processHistory.create({
          data: {
            tenantId,
            companyId,
            empresaId: companyId,

            productId: lot.productId,
            type: ProcessHistoryType.STOCK_OUT,
            status: ProcessHistoryStatus.APPLIED,

            quantity: c.qty,
            unit: (c.unit ?? lot.unit ?? null) as any,

            nfSaidaId: nfe.id,
            reference: `STOCK_OUT por NF draft ${nfe.id}`,

            processSnapshot: {
              nfeId: nfe.id,
              lotId: lot.id,
              movementId: movement.id,
              sku: c.sku ?? null,
              processo: lot.processo ?? null,
              empresaIdLote: lot.empresaId ?? null,
              recipient: {
                tipo: recipientTipo,
                id: dto.recipient.id,
                name: recipientTipo === 'CUSTOMER' ? customer!.name : supplier!.name,
              },
            },
          },
        })
      }
	  const transportadoraSnapshot =
			dto?.transportadora
			? { nome: dto.transportadora.nome ?? null, cnpj: dto.transportadora.cnpj ?? null }
			: null
      await tx.processHistory.create({
        data: {
          tenantId,
          companyId,
          empresaId: companyId,
          type: ProcessHistoryType.NF_EMITIDA,
          status: ProcessHistoryStatus.APPLIED,
          nfSaidaId: nfe.id,
          reference: `NF criada (draft) para ${recipientTipo === 'CUSTOMER' ? customer!.name : supplier!.name}`,
          processSnapshot: {
            nfeId: nfe.id,
            recipientTipo,
            recipientId: dto.recipient.id,
            itemsCount: nfe.items.length,
            observacoes: dto.observacoes ?? null,
            transportadora: transportadoraSnapshot,
            totals: {
              totalProducts: totalProducts.toString(),
              totalInvoice: totalProducts.toString(),
            },
          },
        },
      })

      return {
        message: 'NF criada (draft) + estoque baixado',
        nfeId: nfe.id,
        status: nfe.status,
        items: nfe.items,
      }
    })

    return result
  }

  // ===========================================================
  // Helpers
  // ===========================================================
  // Detecta formato de parcelas "15d+28d+45d" e retorna lista de { dueDate, amount } ou null.
  private parseInstallments(billingTerms: string, issueDate: Date, totalAmount: number): { dueDate: Date; amount: Decimal }[] | null {
    if (!billingTerms.includes('+')) return null
    const parts = billingTerms.split('+')
    const dayMatches = parts.map(p => p.match(/^(\d+)d$/))
    if (dayMatches.some(m => !m)) return null
    const days = dayMatches.map(m => parseInt(m![1], 10))
    const n = days.length
    const installmentAmount = new Decimal(totalAmount).dividedBy(n).toDecimalPlaces(2)
    const sumOfFirst = installmentAmount.times(n - 1)
    const lastAmount = new Decimal(totalAmount).minus(sumOfFirst)
    return days.map((d, i) => {
      const date = new Date(issueDate)
      date.setDate(date.getDate() + d)
      return { dueDate: date, amount: i === n - 1 ? lastAmount : installmentAmount }
    })
  }

  // Calcula o vencimento com base no billingTerms do cliente.
  // "dia15" | "dia20" → acúmulo mensal, vence dia 15 ou 20 do mês seguinte
  // "7d" | "15d" | "28d" | "45d" → N dias após emissão
  // Sem billingTerms → 30 dias corridos (default seguro)
  private computeDueDateFromBillingTerms(issueDate: Date, billingTerms?: string | null): Date {
    const d = new Date(issueDate)
    if (!billingTerms) {
      d.setDate(d.getDate() + 30)
      return d
    }
    if (billingTerms === 'dia15') {
      d.setMonth(d.getMonth() + 1)
      d.setDate(15)
      return d
    }
    if (billingTerms === 'dia20') {
      d.setMonth(d.getMonth() + 1)
      d.setDate(20)
      return d
    }
    const daysMatch = billingTerms.match(/^(\d+)d$/)
    if (daysMatch) {
      d.setDate(d.getDate() + parseInt(daysMatch[1], 10))
      return d
    }
    // fallback
    d.setDate(d.getDate() + 30)
    return d
  }

  // Legacy: mantida para compatibilidade
  private computeDueDate(issueDate: Date, paymentTermDay?: number | null): Date {
    const d = new Date(issueDate)
    if (!paymentTermDay) {
      d.setDate(d.getDate() + 30)
      return d
    }
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(paymentTermDay, 28))
    return d
  }

  private getCsosnFromTaxes(taxes: any): string | null {
    if (!taxes) return null
    if (typeof taxes !== 'object') return null
    if (Array.isArray(taxes)) return null
    const csosn = (taxes as any).csosn
    if (csosn === undefined || csosn === null) return null
    return String(csosn)
  }

  private buildEmitDtoFromDraft(nfe: any, nNF?: number, tpAmb?: '1' | '2', freteValor = 0, ibptRates?: { federalPct: number; estadualPct: number }): NfeXmlDto {
    const emitente = nfe.company
    if (!emitente) throw new BadRequestException('Company não carregada na NF')

    const receiver = nfe.customer ?? nfe.supplier
    if (!receiver) throw new BadRequestException('NF sem destinatário (customer/supplier)')

    // Taxa de crédito ICMS Simples Nacional da empresa (ex: 1.25%)
    const icmsSnRate = Number((emitente as any).icmsSnRate ?? 0)

    const ibptPct = (ibptRates?.federalPct ?? IBPT_FEDERAL_PCT) + (ibptRates?.estadualPct ?? IBPT_ESTADUAL_PCT)
    const RETORNO_CFOPS = ['5902', '6902', '5903', '6903']

    const itens = (nfe.items ?? []).map((it: any) => {
      const taxes = it?.taxes as any
      const csosn = taxes?.csosn ? String(taxes.csosn) : '400'
      const cfop = String(it?.cfop ?? '')
      const total = Number(it.qty ?? 0) * Number(it.unitPrice ?? 0)
      // Calcula crédito ICMS para CSOSN 101, 201, 900
      const hasCredit = ['101', '201', '900'].includes(csosn)
      const pCredSN = hasCredit ? icmsSnRate : 0
      const vCredICMSSN = hasCredit ? parseFloat((total * pCredSN / 100).toFixed(2)) : 0
      // vTotTrib: apenas itens faturáveis (exclui retorno de industrialização 5902/6902)
      const isRetorno = RETORNO_CFOPS.some(c => cfop.startsWith(c.slice(0, 4)))
      const vTotTrib = isRetorno ? 0 : parseFloat((total * ibptPct / 100).toFixed(2))
      return {
        codigo: it.sku ?? '',
        descricao: it.description ?? '',
        ncm: it.ncm ?? '',
        cfop: it.cfop ?? '',
        unidade: it.unit ?? 'UN',
        quantidade: Number(it.qty ?? 0),
        valorUnitario: Number(it.unitPrice ?? 0),
        frete: 0,
        cest: taxes?.cest ?? undefined,
        vTotTrib,
        impostos: {
          icms: { csosn, aliquota: pCredSN, valor: vCredICMSSN },
          ipi: { cst: taxes?.ipiCst ?? '53' },
          pis: { cst: taxes?.pisCst ?? '08' },
          cofins: { cst: taxes?.cofinsCst ?? '08' },
        },
      }
    })

    const totalProdutos = itens.reduce(
      (s: number, i: any) => s + Number(i.quantidade) * Number(i.valorUnitario),
      0,
    )

    // modFrete: mapeamento freightPayer (enum) → código numérico NF-e
    const freightPayerMap: Record<string, number> = {
      EMITENTE: 0, DESTINATARIO: 1, TERCEIROS: 2, SEM_FRETE: 9,
    }
    const modFrete = freightPayerMap[nfe.freightPayer ?? ''] ?? 1

    // Valor de cobrança: exclui CFOPs de retorno/devolução do cliente
    const billingAmt = this.calcBillingAmount(nfe.items ?? []) ?? totalProdutos
    const nonBillingAmt = parseFloat((totalProdutos - billingAmt).toFixed(2))

    // Cobrança: gera cobr a partir de billingTerms do cliente
    const billingTerms = (nfe.customer as any)?.billingTerms ?? null
    let cobrSection: NfeXmlDto['cobr'] | undefined
    if (billingTerms && billingAmt > 0) {
      const nfNumStr = String(nNF ?? '').padStart(9, '0')
      // Fatura e duplicata incluem frete do emitente (vFrete somado ao valor de cobrança)
      const billingAmtTotal = parseFloat((billingAmt + freteValor).toFixed(2))
      const installments = this.parseInstallments(billingTerms, new Date(), billingAmtTotal)
      if (installments) {
        cobrSection = {
          fatura: { numero: nfNumStr, vOrig: billingAmtTotal, vLiq: billingAmtTotal },
          duplicatas: installments.map((inst, i) => ({
            numero: String(i + 1).padStart(3, '0'),
            dVenc: inst.dueDate.toISOString().slice(0, 10),
            valor: inst.amount.toNumber(),
          })),
        }
      } else {
        const dueDate = this.computeDueDateFromBillingTerms(new Date(), billingTerms)
        cobrSection = {
          fatura: { numero: nfNumStr, vOrig: billingAmtTotal, vLiq: billingAmtTotal },
          duplicatas: [{
            numero: '001',
            dVenc: dueDate.toISOString().slice(0, 10),
            valor: billingAmtTotal,
          }],
        }
      }
    }

    const emitDto: NfeXmlDto = {
      nNF,
      tpAmb,

      naturezaOperacao: nfe.naturezaOperacao ?? 'Prestacao de servico de beneficiamento',
      cnpjEmitente: String(emitente.cnpj ?? ''),
      razaoSocial: String(emitente.legalName ?? emitente.tradeName ?? ''),
      nomeFantasia: String(emitente.tradeName ?? emitente.legalName ?? ''),
      ie: String(emitente.ie ?? ''),
      crt: String((emitente as any).crt ?? '1'),
      endereco: String(emitente.address ?? ''),
      numero: String((emitente as any).number ?? ''),
      bairro: String((emitente as any).district ?? ''),
      municipio: String((emitente as any).city ?? ''),
      municipioCodigo: String((emitente as any).cityCode ?? ''),
      uf: String((emitente as any).uf ?? ''),
      cep: String((emitente as any).zip ?? ''),
      telefone: String((emitente as any).phone ?? ''),

      cliente: {
        nome: receiver.name ?? '',
        cnpjCpf: receiver.document ?? '',
        ie: receiver.ie ?? undefined,
        email: receiver.email ?? '',
        endereco: receiver.address ?? '',
        numero: receiver.number ?? undefined,
        bairro: receiver.district ?? undefined,
        complemento: receiver.complement ?? undefined,
        municipio: receiver.city ?? '',
        municipioCodigo: receiver.cityCode ?? undefined,
        uf: receiver.state ?? receiver.uf ?? '',
        cep: receiver.zip ?? undefined,
        telefone: receiver.phone ?? undefined,
      },

      itens,

      transporte: {
        modFrete,
        transportadora: nfe.transportadora ?? undefined,
        cnpj: nfe.cnpjTransportadora ?? undefined,
        qVol: nfe.volumesQty ?? undefined,
        esp: nfe.volumesSpecies ?? undefined,
        marca: nfe.volumesBrand ?? undefined,
        pesoL: nfe.weightNet ? Number(nfe.weightNet) : undefined,
        pesoB: nfe.weightGross ? Number(nfe.weightGross) : undefined,
      },

      cobr: cobrSection,

      pagamento: {
        formas: [
          { indPag: 1, tipo: '01', valor: billingAmt },
          ...(nonBillingAmt > 0.001 ? [{ tipo: '99', valor: nonBillingAmt, descricao: 'RETORNO SIMBOLICO' }] : []),
        ],
      },

      totalProdutos,
      totalFrete: freteValor,
      totalImpostos: parseFloat((billingAmt * ibptPct / 100).toFixed(2)),
      totalNFe: totalProdutos + freteValor,

      cNFCode: (nfe as any).cNFCode ?? undefined,
      refNFe: (nfe as any).refNFe ?? undefined,

      informacoesAdicionais: this.buildInfoAdic(itens, icmsSnRate, tpAmb, billingAmt, (nfe as any).refNFe, ibptRates, 'xml'),
    }

    return emitDto
  }

  private buildInfoAdic(
    itens: any[],
    icmsSnRate: number,
    tpAmb?: '1' | '2',
    billingBase?: number,
    refNFe?: string,
    ibptRates?: { federalPct: number; estadualPct: number },
    format: 'xml' | 'pdf' = 'xml',
  ): string | undefined {
    const homologParts: string[] = []
    if (tpAmb === '2') homologParts.push('AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL')

    // Referência às NFs do cliente
    // Formatos aceitos por linha:
    //   "23778|10/2025"        → DEV. TOTAL DA SUA NF-E 23778 DE 10/2025
    //   "23778|10/2025|P"      → DEV. PARCIAL DA SUA NF-E 23778 DE 10/2025
    //   chave44dígitos (|P)    → extrai número+data da chave
    const devParts: string[] = []
    if (refNFe) {
      const refs = refNFe.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean)
      for (const ref of refs) {
        try {
          const parts2 = ref.split('|')
          const raw = parts2[0].replace(/\s/g, '')

          if (raw.length === 44 && /^\d+$/.test(raw)) {
            // Extrai AAMM da chave e converte para DD/MM/AAAA (usa dia 01)
            const aamm = raw.slice(2, 6)
            const nNFRef = String(parseInt(raw.slice(25, 34), 10))
            const ano = '20' + aamm.slice(0, 2)
            const mes = aamm.slice(2, 4)
            const tipoLabel = parts2[1]?.toUpperCase() === 'P' ? 'PARCIAL' : 'TOTAL'
            devParts.push(`DEV. ${tipoLabel} DA SUA NF-E ${nNFRef} DE 01/${mes}/${ano}`)
          } else {
            const nfNum = raw
            // Aceita MM/AAAA ou DD/MM/AAAA
            const datePartRaw = parts2[1]
            let dateFmt: string | undefined
            if (datePartRaw?.match(/^\d{2}\/\d{4}$/)) {
              // MM/AAAA → 01/MM/AAAA
              dateFmt = `01/${datePartRaw}`
            } else if (datePartRaw?.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
              dateFmt = datePartRaw
            }
            const tipoIdx = dateFmt ? 2 : 1
            const tipoLabel = parts2[tipoIdx]?.toUpperCase() === 'P' ? 'PARCIAL' : 'TOTAL'
            devParts.push(dateFmt
              ? `DEV. ${tipoLabel} DA SUA NF-E ${nfNum} DE ${dateFmt}`
              : `DEV. ${tipoLabel} DA SUA NF-E ${nfNum}`)
          }
        } catch { /* ignora referências malformadas */ }
      }
    }

    // Crédito ICMS SN para CSOSN 900/101/201
    let icmsPart = ''
    const totalCredit = itens
      .filter(i => ['101', '201', '900'].includes(i.impostos?.icms?.csosn ?? ''))
      .reduce((acc, i) => acc + (i.impostos?.icms?.valor ?? 0), 0)
    if (totalCredit > 0 && icmsSnRate > 0) {
      const creditFmt = totalCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      icmsPart = `PERMITE O APROVEITAMENTO DO CREDITO DE ICMS NO VALOR DE R$ ${creditFmt} CORRESPONDENTE A ALIQUOTA DE ${icmsSnRate.toFixed(2)}% NOS TERMOS DO ART. 23 DA LEI COMPLEMENTAR 123/2006`
    }

    // Tributos aproximados IBPT — calculados sobre itens faturáveis (exclui 5902)
    let tribPart = ''
    if (billingBase && billingBase > 0) {
      const federalPct = ibptRates?.federalPct ?? IBPT_FEDERAL_PCT
      const estadualPct = ibptRates?.estadualPct ?? IBPT_ESTADUAL_PCT
      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      tribPart = `Trib. aprox R$ ${fmt(billingBase * federalPct / 100)} (${federalPct.toFixed(2)}%) Federal e R$ ${fmt(billingBase * estadualPct / 100)} (${estadualPct.toFixed(2)}%) Estadual Fonte: IBPT.`
    }

    if (format === 'pdf') {
      // Para o DANFE: texto principal no topo, ICMS+tributos ancorados na base
      const topLines: string[] = [...homologParts, ...devParts]
      const bottomLines: string[] = []
      if (icmsPart) bottomLines.push(icmsPart)
      if (tribPart) bottomLines.push(tribPart)
      return {
        top: topLines.length > 0 ? topLines.join('\n') : undefined,
        bottom: bottomLines.length > 0 ? bottomLines.join('\n') : undefined,
      } as any
    } else {
      // Para o XML: separador |
      const all = [...homologParts, ...devParts]
      if (icmsPart) all.push('', '', '', '', icmsPart) // 4 pipes de espaço
      if (tribPart) { all.push('', tribPart) }
      return all.length > 0 ? all.join('|') : undefined
    }
  }

  // ===========================================================
  // Chamada SEFAZ — mode-aware
  // ===========================================================
  private async callSefaz(
    signedXml: string,
    certBuffer: Buffer | null,
    certPassword: string,
  ): Promise<{ cStat: string; xMotivo: string; nProt: string | null }> {
    const mode = getSefazEnv()

    // ── Modo Simulador: resposta fake, sem chamada de rede ────────────────────
    if (mode === 'simulator') {
      this.logger.log('📋 SEFAZ em modo SIMULADOR — nenhuma chamada de rede realizada')
      return { cStat: 'SIMULADO', xMotivo: 'Autorizado (simulação local)', nProt: null }
    }

    // ── Modo Real: SOAP 1.2 para SEFAZ-SP ────────────────────────────────���────
    // Extrai o elemento <NFe>...</NFe> do XML assinado para enviar ao SEFAZ
    // (O SEFAZ espera o NFe dentro do enviNFe, não o documento completo)
    const nfeMatch = signedXml.match(/<NFe\b[^>]*>[\s\S]*<\/NFe>/)
    if (!nfeMatch) throw new BadRequestException('Não foi possível extrair elemento NFe do XML assinado')
    const nfeElement = nfeMatch[0]

    // Envelope SOAP 1.2 para NFeAutorizacao4
    const idLote = Date.now().toString().slice(-15) // 15 dígitos
    // Envelope SOAP compacto — SEFAZ rejeita whitespace entre tags (cStat=588)
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><cUF>${process.env.SEFAZ_UF ?? '35'}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfeElement}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`

    // Endpoint SEFAZ-SP (homologação ou produção)
    const endpoints: Record<string, string> = {
      homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      producao:    'https://nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    }
    const url = endpoints[mode]

    // HTTPS agent com o certificado A1 para autenticação mútua TLS
    // Usa node-forge para extrair key/cert como PEM (evita incompatibilidade RC2 do OpenSSL 3.x)
    const pfxDer = certBuffer!.toString('binary')
    const p12Asn1 = forge.asn1.fromDer(pfxDer)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword)
    const keyBags = p12.getBags({ bagType: (forge.pki.oids as any).pkcs8ShroudedKeyBag })[(forge.pki.oids as any).pkcs8ShroudedKeyBag] ?? []
    const certBags = p12.getBags({ bagType: (forge.pki.oids as any).certBag })[(forge.pki.oids as any).certBag] ?? []
    const privateKeyPem = forge.pki.privateKeyToPem(keyBags[0].key!)
    const certPem = forge.pki.certificateToPem(certBags[0].cert!)
    const httpsAgent = new https.Agent({
      key: privateKeyPem,
      cert: certPem,
      rejectUnauthorized: false, // ICP-Brasil CA não está no bundle padrão do Node.js
    })

    try {
      const res = await axios.post(url, soapEnvelope, {
        httpsAgent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': '""',
        },
        timeout: 30_000,
      })

      // Parseia o XML de resposta para extrair cStat, xMotivo e nProt
      return await this.parseSefazResponse(res.data)
    } catch (err: any) {
      const msg = err?.message ?? 'Erro de comunicação com SEFAZ'
      this.logger.error(`❌ Erro ao chamar SEFAZ: ${msg}`)
      throw new BadRequestException(`Falha na comunicação com SEFAZ: ${msg}`)
    }
  }

  // Extrai os campos relevantes da resposta SOAP do SEFAZ
  private async parseSefazResponse(
    soapXml: string,
  ): Promise<{ cStat: string; xMotivo: string; nProt: string | null }> {
    try {
      const parsed = await xml2js.parseStringPromise(soapXml, { explicitArray: false })

      // Navega na estrutura SOAP para chegar no retEnviNFe
      const body = parsed?.['soap:Envelope']?.['soap:Body']
                ?? parsed?.['soap12:Envelope']?.['soap12:Body']
                ?? {}

      const nfeDadosRet = body?.['nfeResultMsg']?.['retEnviNFe']
                       ?? body?.['nfeDadosRet']?.['retEnviNFe']
                       ?? (Object.values(body ?? {}) as any[])[0]?.['retEnviNFe']
                       ?? {}

      // cStat do lote (ex: 104 = lote processado); cStat da NF individual fica no infProt
      const cStatLote: string = nfeDadosRet?.cStat ?? nfeDadosRet?.['ns1:cStat'] ?? 'ERRO'

      // Protocolo de autorização — está dentro de protNFe.infProt quando autorizado
      const infProt = nfeDadosRet?.protNFe?.infProt ?? nfeDadosRet?.['ns1:protNFe']?.['ns1:infProt']
      const nProt: string | null = infProt?.nProt ?? null

      // Se o lote foi processado (104) usa o cStat individual do infProt; caso contrário usa o do lote
      const cStat: string = (cStatLote === '104' && infProt?.cStat)
        ? String(infProt.cStat)
        : cStatLote
      const xMotivo: string = (cStatLote === '104' && infProt?.xMotivo)
        ? String(infProt.xMotivo)
        : (nfeDadosRet?.xMotivo ?? nfeDadosRet?.['ns1:xMotivo'] ?? 'Resposta não reconhecida')

      this.logger.log(`📡 SEFAZ resposta: cStat=${cStat} — ${xMotivo}`)
      return { cStat, xMotivo, nProt }
    } catch {
      this.logger.warn('⚠️ Não foi possível parsear a resposta SOAP do SEFAZ')
      return { cStat: 'PARSE_ERROR', xMotivo: 'Erro ao interpretar resposta SEFAZ', nProt: null }
    }
  }

  // ===========================================================
  // Extrai nNF
  // ===========================================================
  private extractNumeroNF(xml: string): string {
    const match = xml.match(/<nNF>(\d+)<\/nNF>/)
    return match ? match[1] : `${Date.now()}`
  }
}

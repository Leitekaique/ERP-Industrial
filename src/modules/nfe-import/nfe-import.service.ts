import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { parseStringPromise } from 'xml2js'
import * as fs from 'fs'
import * as path from 'path'
import {
  DEFAULT_TENANT_ID,
  DEFAULT_COMPANY_ID,
} from '../../common/constants/tenant-company.constants'
import { ProcessHistoryService } from '../process-history/process-history.service'
import { ProcessHistoryType } from '@prisma/client'


const UPLOAD_DIR = path.resolve('./uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

@Injectable()
export class NfeImportService {
  private readonly logger = new Logger(NfeImportService.name)

  constructor(
	private prisma: PrismaService,
	private processHistoryService: ProcessHistoryService,
	) {}

  // ===========================================================
  // 🚀 PROCESSA XML
  // ===========================================================
  async processXml(
    file: Express.Multer.File,
    tenantId = DEFAULT_TENANT_ID,
    companyId = DEFAULT_COMPANY_ID, // Tapajós (ERP owner)
  ) {
    try {
      if (!file) throw new BadRequestException('Arquivo XML não enviado.')

      const xmlContent = await this.getXmlContent(file)
      const parsed = await parseStringPromise(xmlContent, { explicitArray: false })

      const infNFe =
        parsed?.nfeProc?.NFe?.infNFe ??
        parsed?.NFe?.infNFe ??
        parsed?.procNFe?.NFe?.infNFe ??
        null

      if (!infNFe) {
        throw new BadRequestException('Estrutura XML de NF-e não reconhecida.')
      }

	  const ide = infNFe.ide
	  const nfNumber = ide?.nNF ? String(ide.nNF) : null
	  const serie = ide?.serie ? String(ide.serie) : null
	  const modelo = ide?.mod ? String(ide.mod) : null
	  const nfEntrada = nfNumber ? (serie ? `${serie}-${nfNumber}` : nfNumber) : null
      const emit = infNFe.emit
      const dest = infNFe.dest
      const itens = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det]

      const accessKey = infNFe['$']?.Id?.replace('NFe', '')
      if (!accessKey) throw new BadRequestException('Chave da NF não encontrada.')

      const exists = await this.prisma.nfeImport.findUnique({
        where: { accessKey },
      })
      if (exists) throw new BadRequestException('NF já importada.')

      const dataEmissao = ide?.dhEmi ? new Date(ide.dhEmi) : new Date()

      const tipoNf = this.classifyNfe({
        natOp: ide?.natOp ?? '',
        cfops: itens.map((i: any) => i?.prod?.CFOP),
        emitCnpj: emit?.CNPJ ?? null,
        destCnpj: dest?.CNPJ ?? null,
        companyCnpj: await this.getCompanyCnpj(companyId),
      })

      const { supplier, customer } = await this.ensurePartners({
        tenantId,
        companyId,
        tipoNf,
        emit,
        dest,
      })
	  const nfImport = await this.prisma.nfeImport.create({
        data: {
          tenantId,
          companyId,
          accessKey,
          emitente: emit?.xNome,
          destinatario: dest?.xNome,
          valorTotal: Number(infNFe.total?.ICMSTot?.vNF ?? 0),
          dataEmissao,
          xmlPath: file.path,
		  nfNumber,
		  serie,
		  modelo,
        },
      })

      for (const det of itens) {
        await this.handleProductImport({
          tenantId,
          companyId,
          tipoNf,
          item: det.prod,
          supplier,
          customer,
          dataEmissao,
          reference: ide?.cNF ?? accessKey,
		  nfEntrada,        // o que vai pra coluna NF entrada
		  nfImportId: nfImport.id,   // se você quiser amarrar depois em FK
		  accessKey,
        })
      }

      // ── Auto-cria Contas a Pagar para NF de consumo e compra de insumos ──────
      if ((tipoNf === 'CONSUMO' || tipoNf === 'COMPRA_INSUMO') && supplier) {
        await this.createPayablesFromNf({
          tenantId,
          companyId,
          supplierId: supplier.id,
          nfeImportId: nfImport.id,
          infNFe,
          valorTotal: Number(infNFe.total?.ICMSTot?.vNF ?? 0),
          dataEmissao,
        })
      }

      return { message: 'NF importada com sucesso.' }
    } catch (err: any) {
      this.logger.error(err.message, err.stack)
      throw new InternalServerErrorException(err.message)
    }
  }

  // ===========================================================
  // 🔍 CLASSIFICAÇÃO DA NF
  // ===========================================================
private classifyNfe({
  natOp,
  cfops,
  emitCnpj,
  destCnpj,
  companyCnpj,
}: {
  natOp: string;
  cfops: string[];
  emitCnpj: string;
  destCnpj: string;
  companyCnpj: string;
}):
  | 'COMPRA_INSUMO'
  | 'CONSUMO'
  | 'REMESSA_IND'
  | 'TRIANGULACAO'
  | 'OUTROS' {

  const cfopSet = new Set(
    cfops.filter(Boolean).map(c => c.toString())
  );

  // 🔹 Remessa para industrialização
  if (
	natOp.toUpperCase().includes('REMESSA') ||
	natOp.toUpperCase().includes('INDUSTRIA')
  ) {
	return 'REMESSA_IND';
  }

  // 🔹 Triangulação / por conta e ordem
  if ([ '5924', '6924' ].some(c => cfopSet.has(c))) {
    return 'TRIANGULACAO';
  }

  // 🔹 Compra de insumos (emitente VENDE, Tapajós COMPRA)
  if ([ '5101', '6101' ].some(c => cfopSet.has(c))) {
    return 'COMPRA_INSUMO';
  }

  // 🔹 Consumo / uso / revenda sem estoque
  if ([ '5102', '6102', '1556', '2556' ].some(c => cfopSet.has(c))) {
    return 'CONSUMO';
  }

  // 🔹 Fallback
  return 'OUTROS';
}


  // ===========================================================
  // 🧑‍🤝‍🧑 PARCEIROS
  // ===========================================================
  private async ensurePartners({
    tenantId,
    companyId,
    tipoNf,
    emit,
    dest,
  }: any) {
    let supplier = null
    let customer = null

    if (tipoNf === 'COMPRA_INSUMO' || tipoNf === 'CONSUMO') {
      supplier = await this.upsertSupplier(tenantId, companyId, emit)
    }

    if (tipoNf === 'REMESSA_IND') {
      customer = await this.upsertCustomer(tenantId, companyId, emit)
    }
	
	if (tipoNf === 'TRIANGULACAO') {
	  customer = await this.upsertCustomer(tenantId, companyId, emit);
	}
    return { supplier, customer }
  }

  // Gera update parcial: só inclui o campo se o valor da NF for não-nulo,
  // preservando dados preenchidos manualmente (email, phone, etc.)
  private nfUpdate(fields: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
    )
  }

  private async upsertSupplier(tenantId: string, companyId: string, emit: any) {
    const nfData = {
      name: emit.xNome ?? null,
      ie: emit.IE ?? null,
      email: emit?.email ?? null,
      phone: emit?.enderEmit?.fone ?? emit?.fone ?? null,
      zip: emit?.enderEmit?.CEP ?? null,
      address: emit?.enderEmit?.xLgr ?? null,
      number: emit?.enderEmit?.nro ?? null,
      district: emit?.enderEmit?.xBairro ?? null,
      city: emit?.enderEmit?.xMun ?? null,
      state: emit?.enderEmit?.UF ?? null,
    }
    return this.prisma.supplier.upsert({
      where: { document: emit.CNPJ },
      create: {
        tenantId,
        companyId,
        docType: emit?.CNPJ ? 'CNPJ' : 'CPF',
        document: emit.CNPJ,
        name: nfData.name ?? 'Fornecedor',
        ...Object.fromEntries(Object.entries(nfData).filter(([k, v]) => k !== 'name' && v !== null && v !== undefined && v !== '')),
      },
      update: this.nfUpdate(nfData),
    })
  }

  private async upsertCustomer(tenantId: string, companyId: string, emit: any) {
    const nfData = {
      name: emit.xNome ?? null,
      ie: emit.IE ?? null,
      email: emit?.email ?? null,
      phone: emit?.enderEmit?.fone ?? emit?.fone ?? null,
      zip: emit?.enderEmit?.CEP ?? null,
      address: emit?.enderEmit?.xLgr ?? null,
      number: emit?.enderEmit?.nro ?? null,
      district: emit?.enderEmit?.xBairro ?? null,
      city: emit?.enderEmit?.xMun ?? null,
      cityCode: emit?.enderEmit?.cMun ?? null,
      state: emit?.enderEmit?.UF ?? null,
    }
    return this.prisma.customer.upsert({
      where: { document: emit.CNPJ },
      create: {
        tenantId,
        companyId,
        docType: emit?.CNPJ ? 'CNPJ' : 'CPF',
        document: emit.CNPJ,
        name: nfData.name ?? 'Cliente',
        ...Object.fromEntries(Object.entries(nfData).filter(([k, v]) => k !== 'name' && v !== null && v !== undefined && v !== '')),
      },
      update: this.nfUpdate(nfData),
    })
  }

  // ===========================================================
  // 📦 PRODUTOS
  // ===========================================================
  private async handleProductImport({
  tenantId,
  companyId,
  tipoNf,
  item,
  supplier,
  customer,
  dataEmissao,
  reference,
  nfEntrada,
  accessKey,
}: any) {

  /**
   * ===========================================================
   * 1️⃣ CONSUMO / VENDA DE CONSUMÍVEL
   * ===========================================================
   * - Não cria produto
   * - Não cria estoque
   */
  if (tipoNf === 'CONSUMO') {
    return;
  }

  /**
   * ===========================================================
   * 2️⃣ DEFINIÇÃO DE EMPRESA ORIGEM DO PRODUTO
   * ===========================================================
   * - Remessa / Triangulação → empresa emitente
   * - Compra insumo → fornecedor
   * - Fallback → Tapajós
   */
	let empresaIdProduto: string;

	if (tipoNf === 'REMESSA_IND' || tipoNf === 'TRIANGULACAO') {
  // produto físico do cliente
		empresaIdProduto = customer.id;
	} else if (tipoNf === 'COMPRA_INSUMO') {
  // insumo do fornecedor
	empresaIdProduto = supplier.id;
	} else {
	empresaIdProduto = companyId;
	}

let produtoBase: any
const cest = item.CEST ?? null

const importMeta = {
  tipoNf,
  nfEntrada: nfEntrada ?? null,
  accessKey: accessKey ?? null,
  reference: reference ?? null,
}

/**
 * ===========================================================
 * 3️⃣ PRODUTO FÍSICO (sempre que aplicável) e INSUMO
 * ===========================================================
 */
if (tipoNf === 'COMPRA_INSUMO') {
  // INSUMO (unique: tenantId, companyId, sku, empresaId=supplier.id)
  produtoBase = await this.upsertProductWithImportRules({
    tenantId,
    companyId,
    empresaId: supplier.id,
    sku: item.cProd,

    createData: {
      tenantId,
      companyId,
      empresaId: supplier.id,
      supplierId: supplier.id,
      customerId: null,

      sku: item.cProd,
      name: item.xProd,
      unit: item.uCom,
      ncm: item.NCM ?? null,

      // ✅ preço só entra na criação
      price: Number(item.vUnCom ?? 0),

      cfop: '5124',
      taxes: { csosn: '101', ...(cest ? { cest } : {}) },
      processo: 'Insumo',
    },

    // pode atualizar vários campos, mas vamos proteger price/processo/unit
    updateData: {
      name: item.xProd,
      unit: item.uCom,
      ncm: item.NCM ?? null,

      price: Number(item.vUnCom ?? 0), // será ignorado pelo protectFields
      processo: 'Insumo',              // será ignorado
      cfop: '5124',
      taxes: { csosn: '101', ...(cest ? { cest } : {}) },
    },

    // ✅ regra do insumo
    protectFields: ['price', 'processo', 'unit'],
    importMeta,
  })
} else {
  // PF (REMESSA_IND / TRIANGULACAO / OUTROS)
  const processoDefault =
    tipoNf === 'REMESSA_IND'
      ? 'Industrializacao'
      : tipoNf === 'TRIANGULACAO'
        ? 'Definir'
        : 'Definir x'

  // unique: tenantId, companyId, sku, empresaId=empresaIdProduto (customer no seu contrato)
  produtoBase = await this.upsertProductWithImportRules({
    tenantId,
    companyId,
    empresaId: empresaIdProduto,
    sku: item.cProd,

    createData: {
      tenantId,
      companyId,
      empresaId: empresaIdProduto,
      customerId: customer?.id ?? null,
      supplierId: null,

      sku: item.cProd,
      name: item.xProd,
      unit: item.uCom,
      ncm: item.NCM ?? null,
      price: Number(item.vUnCom ?? 0),

      cfop: '5902',
      taxes: { csosn: '900', ...(cest ? { cest } : {}) },

      // ✅ default só na criação
      processo: processoDefault,
    },

    // pode atualizar tudo, exceto processo
    updateData: {
      name: item.xProd,
      unit: item.uCom,
      ncm: item.NCM ?? null,
      price: Number(item.vUnCom ?? 0),

      cfop: '5902',
      taxes: { csosn: '900', ...(cest ? { cest } : {}) },

      processo: processoDefault, // será ignorado pelo protectFields
    },

    // ✅ regra do PF: NÃO atualizar apenas o processo
    protectFields: ['processo'],
    importMeta,
  })
}

/**
 * ===========================================================
 * 4️⃣ PRODUTO MO (SOMENTE REMESSA INDUSTRIALIZAÇÃO)
 * ===========================================================
 */
if (tipoNf === 'REMESSA_IND') {
  await this.upsertProductWithImportRules({
    tenantId,
    companyId,
    empresaId: companyId, // MO sempre Tapajós (company)
    sku: item.cProd,

    createData: {
      tenantId,
      companyId,
      empresaId: companyId,

      sku: item.cProd,
      name: `${item.xProd} - MO`,
      unit: produtoBase.unit, // mesma unidade do físico
      ncm: item.NCM ?? null,
      price: 0.70,

      cfop: '5124',
      taxes: { csosn: '400' },
      processo: 'Industrializacao',
    },

    // você pode atualizar nome/ncm/cfop/taxes, mas não unit/processo/price (pra não sobrescrever edições)
    updateData: {
      name: `${item.xProd} - MO`,
      unit: produtoBase.unit,
      ncm: item.NCM ?? null,

      price: 0.70,                  // protegido
      processo: 'Industrializacao',  // protegido
      cfop: '5124',
      taxes: { csosn: '400' },
    },

    protectFields: ['price', 'processo', 'unit'],
    importMeta,
  })
}


  /**
   * ===========================================================
   * 5️⃣ TRIANGULAÇÃO / POR CONTA E ORDEM
   * ===========================================================
   * - Produto existe
   * - Estoque NÃO é movimentado
   */
  if (tipoNf === 'TRIANGULACAO') {
    return;
  }

  /**
   * ===========================================================
   * 6️⃣ ESTOQUE (COMPRA DE INSUMO / REMESSA)
   * ===========================================================
   */
const warehouse = await this.prisma.warehouse.findFirst({
  where: { tenantId, companyId },
})

if (!warehouse) {
  this.logger.warn('⚠️ Nenhum depósito encontrado.')
  return
}

// 🔹 StockLot
const lot = await this.prisma.stockLot.create({
  data: {
    tenantId,
    companyId,
    productId: produtoBase.id,
    warehouseId: warehouse.id,
    empresaId: empresaIdProduto,
    processo: tipoNf === 'REMESSA_IND' ? 'Industrializacao' : 'Insumo',
    qtyInitial: Number(item.qCom),
    qtyRemaining: Number(item.qCom),
    reference,
    occurredAt: dataEmissao,
    // se você tiver unit no lot/model, pode setar aqui:
    // unit: item.uCom ?? null,
  },
})

// 🔹 StockMovement (GUARDA O RETORNO)
const movement = await this.prisma.stockMovement.create({
  data: {
    tenantId,
    companyId,
    warehouseId: warehouse.id,
    productId: produtoBase.id,
    type: 'in',
    qty: Number(item.qCom),
    unitCost: Number(item.vUnCom), // (você já corrigiu o ?? 0)
    ownership: tipoNf === 'COMPRA_INSUMO' ? 'own' : 'third_party_in',
    note: `Entrada via NF ${nfEntrada ?? reference}`,
    supplierId: supplier?.id ?? null,
    customerId: customer?.id ?? null,
  },
})

// 🔹 ProcessHistory (AGORA COM VARIÁVEIS QUE EXISTEM)
// depois de criar lot e movement...

await this.processHistoryService.record({
  tenantId,
  companyId,
  empresaId: companyId,
  productId: lot.productId,
  type: ProcessHistoryType.STOCK_IN,
  quantity: Number(lot.qtyInitial),
  unit: (lot as any).unit || undefined,
  reference: nfEntrada ? `Entrada via NF ${nfEntrada}`
	: `Entrada via NF ${reference}`,

  processSnapshot: {
    warehouseId: lot.warehouseId,
    movementId: movement.id,
    reference,
	nfEntrada: nfEntrada ?? null,
    accessKey: accessKey ?? null,

    // ✅ guarda a “empresa de origem” no snapshot (sem FK)
    supplierId: supplier?.id ?? null,
    customerId: customer?.id ?? null,
    ownership: tipoNf === 'COMPRA_INSUMO' ? 'own' : 'third_party_in',
  },
})


}


  // ===========================================================
  // AUX
  // ===========================================================
  private async getXmlContent(file: Express.Multer.File): Promise<string> {
    if (file.buffer) return file.buffer.toString('utf8')
    if (file.path) return fs.promises.readFile(file.path, 'utf8')
    throw new BadRequestException('Arquivo inválido.')
  }

  private async getCompanyCnpj(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, cnpj: true },
  })

  if (!company) {
    throw new BadRequestException(
      `Company não encontrada para companyId=${companyId}. Verifique DEFAULT_COMPANY_ID e seed do banco.`,
    )
  }

  if (!company.cnpj) {
    throw new BadRequestException(
      `Company ${company.id} não possui CNPJ cadastrado.`,
    )
  }

  return company.cnpj
}
  // ===========================================================
	// 📄 LISTAGEM DE NF IMPORTADAS
  // ===========================================================
  async listNfes() {
  return this.prisma.nfeImport.findMany({
    orderBy: { createdAt: 'desc' },
  });
}
// ✅ Coloque esse helper no final do NfeImportService (sessão AUX), como último private async.
// Requer: import { ProcessHistoryType } from '@prisma/client'

private async upsertProductWithImportRules(params: {
  tenantId: string
  companyId: string
  empresaId: string
  sku: string
  createData: any
  updateData: any
  protectFields: string[]
  importMeta: {
    tipoNf: string
    nfEntrada?: string | null
    accessKey?: string | null
    reference?: string | null
  }
}) {
  const {
    tenantId,
    companyId,
    empresaId,
    sku,
    createData,
    updateData,
    protectFields,
    importMeta,
  } = params

  const existing = await this.prisma.product.findUnique({
    where: {
      tenantId_companyId_empresaId_sku: {
        tenantId,
        companyId,
        empresaId,
        sku,
      },
    },
  })

  // ===========================================================
  // 1) NÃO EXISTE → CRIA (e registra PRODUTO_IMPORTADO)
  // ===========================================================
  if (!existing) {
    const created = await this.prisma.product.create({ data: createData })

    await this.processHistoryService.record({
      tenantId,
      companyId,
      empresaId: companyId, // ✅ FK segura (Company)

      productId: created.id,
      type: ProcessHistoryType.PRODUTO_IMPORTADO,

      reference: importMeta.nfEntrada
        ? `Produto importado (NF ${importMeta.nfEntrada})`
        : `Produto importado (ref ${importMeta.reference ?? '-'})`,

      processSnapshot: {
        action: 'PRODUTO_CRIADO_NA_IMPORTAÇÃO',
        tipoNf: importMeta.tipoNf,
        sku,
        empresaId,
        nfEntrada: importMeta.nfEntrada ?? null,
        accessKey: importMeta.accessKey ?? null,
        reference: importMeta.reference ?? null,
        createdData: createData,
      },
    })

    return created
  }

  // ===========================================================
  // 2) EXISTE → UPDATE CONTROLADO (sem sobrescrever campos protegidos)
  // ===========================================================
  const safeUpdate: any = { ...updateData }
  for (const f of protectFields) {
    if (f in safeUpdate) delete safeUpdate[f]
  }

  const keys = Object.keys(safeUpdate)
  if (!keys.length) return existing

  // ===========================================================
  // 3) ATUALIZA SÓ O QUE MUDOU (para não “sujar” histórico)
  // ===========================================================
  const diff: any = {}
  for (const k of keys) {
    const before = (existing as any)[k]
    const after = safeUpdate[k]

    const changed =
      typeof after === 'object'
        ? JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)
        : (before ?? null) !== (after ?? null)

    if (changed) diff[k] = after
  }

  if (!Object.keys(diff).length) return existing

  const updated = await this.prisma.product.update({
    where: { id: existing.id },
    data: diff,
  })

  // ===========================================================
  // 4) HISTÓRICO: PRODUTO_ATUALIZADO (somente quando houve mudança)
  // ===========================================================
  await this.processHistoryService.record({
    tenantId,
    companyId,
    empresaId: companyId, // ✅ FK segura (Company)

    productId: existing.id,
    type: ProcessHistoryType.PRODUTO_ATUALIZADO,

    reference: importMeta.nfEntrada
      ? `Produto atualizado via import (NF ${importMeta.nfEntrada})`
      : `Produto atualizado via import (ref ${importMeta.reference ?? '-'})`,

    processSnapshot: {
      action: 'PRODUTO_ATUALIZADO_NA_IMPORTAÇÃO',
      tipoNf: importMeta.tipoNf,
      sku,
      empresaId,
      nfEntrada: importMeta.nfEntrada ?? null,
      accessKey: importMeta.accessKey ?? null,
      reference: importMeta.reference ?? null,
      // before/after só dos campos alterados
      before: Object.fromEntries(
        Object.keys(diff).map((k) => [k, (existing as any)[k] ?? null]),
      ),
      after: Object.fromEntries(
        Object.keys(diff).map((k) => [k, (updated as any)[k] ?? null]),
      ),
    },
  })

  return updated
}

// ===========================================================
// 💸 CONTAS A PAGAR — geradas a partir de <dup> do XML
// ===========================================================
private async createPayablesFromNf({
  tenantId,
  companyId,
  supplierId,
  nfeImportId,
  infNFe,
  valorTotal,
  dataEmissao,
}: {
  tenantId: string
  companyId: string
  supplierId: string
  nfeImportId: string
  infNFe: any
  valorTotal: number
  dataEmissao: Date
}) {
  const cobr = infNFe?.cobr
  let duplicatas: Array<{ nDup?: string; dVenc?: string; vDup?: string }> = []

  if (cobr?.dup) {
    const rawDup = cobr.dup
    duplicatas = Array.isArray(rawDup) ? rawDup : [rawDup]
  }

  if (duplicatas.length > 0) {
    // Cria uma conta a pagar por duplicata
    for (const dup of duplicatas) {
      const dueDate = dup.dVenc
        ? new Date(dup.dVenc)
        : new Date(dataEmissao.getTime() + 30 * 24 * 60 * 60 * 1000)
      const amount = Number(dup.vDup ?? 0)
      if (amount <= 0) continue

      await this.prisma.payable.create({
        data: {
          tenantId,
          companyId,
          supplierId,
          nfeReceivedId: nfeImportId,
          dueDate,
          amount,
          status: 'open',
        },
      })
    }
    this.logger.log(
      `💸 ${duplicatas.length} conta(s) a pagar criadas via <dup> — NF import ${nfeImportId}`,
    )
  } else {
    // Sem <dup>: cria um único registro com vencimento +30 dias
    const dueDate = new Date(dataEmissao.getTime() + 30 * 24 * 60 * 60 * 1000)
    await this.prisma.payable.create({
      data: {
        tenantId,
        companyId,
        supplierId,
        nfeReceivedId: nfeImportId,
        dueDate,
        amount: valorTotal,
        status: 'open',
      },
    })
    this.logger.log(
      `💸 Conta a pagar criada (sem <dup>, venc. +30d) — NF import ${nfeImportId}`,
    )
  }
}
}

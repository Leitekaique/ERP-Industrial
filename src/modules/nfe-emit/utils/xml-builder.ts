import { create } from 'xmlbuilder2'

// ─── Chave de Acesso ──────────────────────────────────────────────────────────
function calcDigitoVerificador(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
  let soma = 0
  let pesoIdx = 0
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i]) * pesos[pesoIdx % 8]
    pesoIdx++
  }
  const resto = soma % 11
  return resto < 2 ? '0' : String(11 - resto)
}

export function gerarCNF(): string {
  return String(Math.floor(Math.random() * 99999999) + 1).padStart(8, '0')
}

export function buildChaveAcesso(params: {
  cnpj: string
  nNF: number
  serie?: number
  dataEmissao?: Date
  cNFCode?: string  // se fornecido, usa este valor fixo (persistido no banco)
}): string {
  const { cnpj, nNF, serie = 1, dataEmissao = new Date(), cNFCode } = params

  const cUF = '35' // SP
  const ano = String(dataEmissao.getFullYear()).slice(2)
  const mes = String(dataEmissao.getMonth() + 1).padStart(2, '0')
  const AAMM = ano + mes

  const cnpjClean = cnpj.replace(/\D/g, '').padStart(14, '0')
  const mod = '55'
  const serieStr = String(serie).padStart(3, '0')
  const nNFStr = String(nNF).padStart(9, '0')
  const tpEmis = '1'
  const cNF = cNFCode ?? gerarCNF()

  const chave43 = cUF + AAMM + cnpjClean + mod + serieStr + nNFStr + tpEmis + cNF
  const cDV = calcDigitoVerificador(chave43)
  return chave43 + cDV
}

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface NfeXmlDto {
  cnpjEmitente: string
  razaoSocial: string
  nomeFantasia?: string
  ie: string
  endereco: string
  numero?: string
  bairro?: string
  complemento?: string
  municipio: string
  municipioCodigo?: string   // código IBGE do município do emitente
  uf: string
  cep?: string
  telefone?: string
  naturezaOperacao: string
  crt?: string
  nNF?: number
  cNFCode?: string   // cNF persistido no banco — evita chave inconsistente entre chamadas
  refNFe?: string    // chave da NF de entrada referenciada (obrigatório para CFOP 5902 — NFref)
  tpAmb?: '1' | '2'
  indIntermed?: '0' | '1'   // 0=operação normal, 1=com intermediador
  cliente: {
    nome: string
    cnpjCpf: string
    ie?: string
    email?: string
    endereco: string
    numero?: string
    bairro?: string
    complemento?: string
    municipio: string
    municipioCodigo?: string  // código IBGE do município do destinatário
    uf: string
    cep?: string
    telefone?: string
  }
  itens: {
    codigo: string
    descricao: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valorUnitario: number
    frete?: number
    cest?: string             // Código Especificador da Substituição Tributária
    vTotTrib?: number           // tributos aproximados IBPT deste item
    impostos?: {
      icms?: { csosn?: string; aliquota?: number; valor?: number }
      ipi?: { cst?: string }
      pis?: { cst?: string }
      cofins?: { cst?: string }
    }
  }[]
  totalProdutos?: number
  totalFrete?: number
  totalImpostos?: number
  totalNFe?: number
  transporte?: {
    modFrete: number
    transportadora?: string
    cnpj?: string
    ie?: string
    endereco?: string
    municipio?: string
    uf?: string
    qVol?: number
    esp?: string
    marca?: string            // marca/identificação dos volumes
    pesoL?: number
    pesoB?: number
  }
  // Cobrança: fatura + duplicatas (geradas a partir de billingTerms)
  cobr?: {
    fatura?: { numero: string; vOrig: number; vLiq: number }
    duplicatas?: { numero: string; dVenc: string; valor: number }[]
  }
  pagamento?: {
    formas?: { indPag?: number; tipo: string; descricao?: string; valor: number }[]
  }
  informacoesAdicionais?: string
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildXml(dto: NfeXmlDto): string {
  const now = new Date()

  const nNF = dto.nNF ?? Math.floor(Date.now() % 99999) + 1
  const tpAmb = dto.tpAmb ?? '2'

  const chave = buildChaveAcesso({ cnpj: dto.cnpjEmitente, nNF, dataEmissao: now, cNFCode: dto.cNFCode })

  // ISO 8601 com timezone Brasil (-03:00)
  const dhEmi = now.toISOString().replace('Z', '-03:00')
  // Data de saída = mesma data de emissão (padrão para serviços)
  const dhSaiEnt = dhEmi

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
    .ele('infNFe', { Id: `NFe${chave}`, versao: '4.00' })

  // ── IDE ────────────────────────────────────────────────────────────────────
  const ide = root.ele('ide')
  ide.ele('cUF').txt('35')
  ide.ele('cNF').txt(chave.slice(35, 43))
  ide.ele('natOp').txt(dto.naturezaOperacao)
  ide.ele('mod').txt('55')
  ide.ele('serie').txt('1')
  ide.ele('nNF').txt(String(nNF))
  ide.ele('dhEmi').txt(dhEmi)
  ide.ele('dhSaiEnt').txt(dhSaiEnt)
  ide.ele('tpNF').txt('1')
  // idDest: 1=intraestadual, 2=interestadual, 3=exterior
  const idDest = dto.cliente.uf && dto.uf && dto.cliente.uf.toUpperCase() !== dto.uf.toUpperCase() ? '2' : '1'
  ide.ele('idDest').txt(idDest)
  ide.ele('cMunFG').txt(dto.municipioCodigo ?? '3545803') // fallback: Santa Bárbara d'Oeste
  ide.ele('tpImp').txt('1')
  ide.ele('tpEmis').txt('1')
  ide.ele('cDV').txt(chave[43])
  ide.ele('tpAmb').txt(tpAmb)
  ide.ele('finNFe').txt('1')
  ide.ele('indFinal').txt('0')
  ide.ele('indPres').txt('9')
  ide.ele('indIntermed').txt(dto.indIntermed ?? '0')
  ide.ele('procEmi').txt('0')
  ide.ele('verProc').txt('TapajosERP-1.0')
  // NFref: referência(s) à NF de entrada (para CFOP 5902 — retorno de industrialização)
  // Suporta múltiplas chaves separadas por vírgula/; — cada chave gera um <NFref>
  if (dto.refNFe) {
    const chaves = dto.refNFe.split(/[,;\n]+/).map(r => r.split('|')[0].replace(/\s/g, '')).filter(k => k.length === 44)
    for (const chave of chaves) {
      ide.ele('NFref').ele('refNFe').txt(chave)
    }
  }

  // ── EMITENTE ───────────────────────────────────────────────────────────────
  const emit = root.ele('emit')
  emit.ele('CNPJ').txt(dto.cnpjEmitente.replace(/\D/g, ''))
  emit.ele('xNome').txt(dto.razaoSocial)
  if (dto.nomeFantasia) emit.ele('xFant').txt(dto.nomeFantasia)
  const enderEmit = emit.ele('enderEmit')
  enderEmit.ele('xLgr').txt(dto.endereco)
  if (dto.numero) enderEmit.ele('nro').txt(dto.numero)
  if (dto.complemento) enderEmit.ele('xCpl').txt(dto.complemento)
  if (dto.bairro) enderEmit.ele('xBairro').txt(dto.bairro)
  if (dto.municipioCodigo) enderEmit.ele('cMun').txt(dto.municipioCodigo)
  enderEmit.ele('xMun').txt(dto.municipio)
  enderEmit.ele('UF').txt(dto.uf)
  if (dto.cep) enderEmit.ele('CEP').txt(dto.cep.replace(/\D/g, ''))
  enderEmit.ele('cPais').txt('1058')
  enderEmit.ele('xPais').txt('BRASIL')
  if (dto.telefone) enderEmit.ele('fone').txt(dto.telefone)
  emit.ele('IE').txt(dto.ie)
  emit.ele('CRT').txt(dto.crt || '1')

  // ── DESTINATÁRIO ───────────────────────────────────────────────────────────
  const dest = root.ele('dest')
  const docDest = dto.cliente.cnpjCpf.replace(/\D/g, '')
  if (docDest.length === 14) {
    dest.ele('CNPJ').txt(docDest)
  } else {
    dest.ele('CPF').txt(docDest)
  }
  dest.ele('xNome').txt(dto.cliente.nome)
  const enderDest = dest.ele('enderDest')
  enderDest.ele('xLgr').txt(dto.cliente.endereco || 'N/D')
  if (dto.cliente.numero) enderDest.ele('nro').txt(dto.cliente.numero)
  if (dto.cliente.complemento) enderDest.ele('xCpl').txt(dto.cliente.complemento)
  if (dto.cliente.bairro) enderDest.ele('xBairro').txt(dto.cliente.bairro)
  if (dto.cliente.municipioCodigo) enderDest.ele('cMun').txt(dto.cliente.municipioCodigo)
  enderDest.ele('xMun').txt(dto.cliente.municipio || 'N/D')
  enderDest.ele('UF').txt(dto.cliente.uf || 'SP')
  if (dto.cliente.cep) enderDest.ele('CEP').txt(dto.cliente.cep.replace(/\D/g, ''))
  enderDest.ele('cPais').txt('1058')
  enderDest.ele('xPais').txt('BRASIL')
  if (dto.cliente.telefone) enderDest.ele('fone').txt(dto.cliente.telefone)
  if (dto.cliente.ie) dest.ele('IE').txt(dto.cliente.ie)
  dest.ele('indIEDest').txt(dto.cliente.ie ? '1' : '9')
  if (dto.cliente.email) dest.ele('email').txt(dto.cliente.email)

  // ── ITENS (det) ────────────────────────────────────────────────────────────
  dto.itens.forEach((item, i) => {
    const det = root.ele('det', { nItem: i + 1 })
    const prod = det.ele('prod')
    prod.ele('cProd').txt(item.codigo || String(i + 1))
    prod.ele('cEAN').txt('SEM GTIN')
    prod.ele('xProd').txt(item.descricao)
    prod.ele('NCM').txt(item.ncm || '00000000')
    if (item.cest) prod.ele('CEST').txt(item.cest)
    prod.ele('CFOP').txt(item.cfop)
    prod.ele('uCom').txt(item.unidade || 'UN')
    prod.ele('qCom').txt(item.quantidade.toFixed(4))
    prod.ele('vUnCom').txt(item.valorUnitario.toFixed(10))
    const subtotal = item.quantidade * item.valorUnitario
    prod.ele('vProd').txt(subtotal.toFixed(2))
    prod.ele('cEANTrib').txt('SEM GTIN')
    prod.ele('uTrib').txt(item.unidade || 'UN')
    prod.ele('qTrib').txt(item.quantidade.toFixed(4))
    prod.ele('vUnTrib').txt(item.valorUnitario.toFixed(10))
    if (item.frete) prod.ele('vFrete').txt(item.frete.toFixed(2))
    prod.ele('indTot').txt('1')

    const imposto = det.ele('imposto')

    // ICMS — Simples Nacional usa CSOSN
    const csosn = item.impostos?.icms?.csosn || '400'
    const icmsNode = imposto.ele('ICMS')
    if (['101', '201', '900'].includes(csosn)) {
      // CSOSN com crédito (101=crédito simples, 201=ST+crédito, 900=outros com crédito)
      const tagName = csosn === '201' ? 'ICMSSN201' : csosn === '900' ? 'ICMSSN900' : 'ICMSSN101'
      const icms = icmsNode.ele(tagName)
      icms.ele('orig').txt('0')
      icms.ele('CSOSN').txt(csosn)
      icms.ele('pCredSN').txt((item.impostos?.icms?.aliquota ?? 0).toFixed(4))
      icms.ele('vCredICMSSN').txt((item.impostos?.icms?.valor ?? 0).toFixed(2))
    } else {
      // 102, 300, 400, 500, 103, etc — sem crédito
      const icms = icmsNode.ele('ICMSSN102')
      icms.ele('orig').txt('0')
      icms.ele('CSOSN').txt(csosn)
    }

    // IPI
    const ipi = imposto.ele('IPI')
    ipi.ele('cEnq').txt('999')
    ipi.ele('IPINT').ele('CST').txt(item.impostos?.ipi?.cst || '53')

    // PIS — CST 08 = NT (operações não tributadas), correto para beneficiamento/industrialização
    imposto.ele('PIS').ele('PISNT').ele('CST').txt(item.impostos?.pis?.cst || '08')

    // COFINS — idem
    imposto.ele('COFINS').ele('COFINSNT').ele('CST').txt(item.impostos?.cofins?.cst || '08')

    // Tributos aproximados IBPT por item (obrigatório desde 2013)
    if (item.vTotTrib !== undefined) {
      imposto.ele('vTotTrib').txt(item.vTotTrib.toFixed(2))
    }
  })

  // ── TOTAIS ─────────────────────────────────────────────────────────────────
  const totalProdutos = dto.totalProdutos
    ?? dto.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)
  const totalFrete = dto.totalFrete ?? dto.itens.reduce((s, i) => s + (i.frete || 0), 0)
  const totalNFe = dto.totalNFe ?? totalProdutos + totalFrete

  const total = root.ele('total').ele('ICMSTot')
  total.ele('vBC').txt('0.00')
  total.ele('vICMS').txt('0.00')
  total.ele('vICMSDeson').txt('0.00')
  total.ele('vFCP').txt('0.00')
  total.ele('vBCST').txt('0.00')
  total.ele('vST').txt('0.00')
  total.ele('vFCPST').txt('0.00')
  total.ele('vFCPSTRet').txt('0.00')
  total.ele('vProd').txt(totalProdutos.toFixed(2))
  total.ele('vFrete').txt(totalFrete.toFixed(2))
  total.ele('vSeg').txt('0.00')
  total.ele('vDesc').txt('0.00')
  total.ele('vII').txt('0.00')
  total.ele('vIPI').txt('0.00')
  total.ele('vIPIDevol').txt('0.00')
  total.ele('vPIS').txt('0.00')
  total.ele('vCOFINS').txt('0.00')
  total.ele('vOutro').txt('0.00')
  total.ele('vNF').txt(totalNFe.toFixed(2))
  total.ele('vTotTrib').txt((dto.totalImpostos || 0).toFixed(2))

  // ── TRANSPORTE ─────────────────────────────────────────────────────────────
  const transp = root.ele('transp')
  transp.ele('modFrete').txt(String(dto.transporte?.modFrete ?? 1))
  if (dto.transporte?.transportadora || dto.transporte?.cnpj) {
    const transporta = transp.ele('transporta')
    if (dto.transporte.cnpj) transporta.ele('CNPJ').txt(dto.transporte.cnpj.replace(/\D/g, ''))
    if (dto.transporte.transportadora) transporta.ele('xNome').txt(dto.transporte.transportadora)
    if (dto.transporte.ie) transporta.ele('IE').txt(dto.transporte.ie)
    if (dto.transporte.endereco) transporta.ele('xEnder').txt(dto.transporte.endereco)
    if (dto.transporte.municipio) transporta.ele('xMun').txt(dto.transporte.municipio)
    if (dto.transporte.uf) transporta.ele('UF').txt(dto.transporte.uf)
  }
  const vol = transp.ele('vol')
  vol.ele('qVol').txt(String(dto.transporte?.qVol ?? 0))
  vol.ele('esp').txt(dto.transporte?.esp || '')
  if (dto.transporte?.marca) vol.ele('marca').txt(dto.transporte.marca)
  vol.ele('pesoL').txt((dto.transporte?.pesoL ?? 0).toFixed(3))
  vol.ele('pesoB').txt((dto.transporte?.pesoB ?? 0).toFixed(3))

  // ── COBRANÇA (fatura + duplicatas) ─────────────────────────────────────────
  // Obrigatório em NF-e de beneficiamento/serviço com condição de pagamento definida
  if (dto.cobr && (dto.cobr.fatura || dto.cobr.duplicatas?.length)) {
    const cobr = root.ele('cobr')
    if (dto.cobr.fatura) {
      const fat = cobr.ele('fat')
      fat.ele('nFat').txt(dto.cobr.fatura.numero)
      fat.ele('vOrig').txt(dto.cobr.fatura.vOrig.toFixed(2))
      fat.ele('vLiq').txt(dto.cobr.fatura.vLiq.toFixed(2))
    }
    if (dto.cobr.duplicatas?.length) {
      for (const dup of dto.cobr.duplicatas) {
        const d = cobr.ele('dup')
        d.ele('nDup').txt(dup.numero)
        d.ele('dVenc').txt(dup.dVenc)
        d.ele('vDup').txt(dup.valor.toFixed(2))
      }
    }
  }

  // ── PAGAMENTO ──────────────────────────────────────────────────────────────
  const pag = root.ele('pag')
  const formas = dto.pagamento?.formas ?? [{ tipo: '90', valor: totalNFe }]
  formas.forEach((f) => {
    const detPag = pag.ele('detPag')
    if (f.indPag !== undefined) detPag.ele('indPag').txt(String(f.indPag))
    detPag.ele('tPag').txt(f.tipo)
    detPag.ele('vPag').txt(f.valor.toFixed(2))
  })

  // ── INFORMAÇÕES ADICIONAIS ─────────────────────────────────────────────────
  const crt = dto.crt || '1'
  const disclaimers: string[] = []

  // Simples Nacional (CRT 1): declarações obrigatórias
  if (crt === '1') {
    disclaimers.push('I. DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL')
    disclaimers.push('II. NAO GERA DIREITO A CREDITO FISCAL DE IPI')
  }

  if (dto.informacoesAdicionais) disclaimers.push(dto.informacoesAdicionais)

  if (disclaimers.length) {
    root.ele('infAdic').ele('infCpl').txt(disclaimers.join('|'))
  }

  return root.end({ prettyPrint: false })
}

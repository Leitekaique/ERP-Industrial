// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as typeof import('pdfkit')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bwipjs = require('bwip-js')
import * as fs from 'fs'
import * as path from 'path'

export interface DanfeData {
  number: number | string
  series: number | string
  chaveAcesso?: string
  naturezaOperacao: string
  issuedAt: Date | string
  tpAmb: '1' | '2'
  protocol?: string | null

  emitNome: string
  emitFantasia?: string
  emitCnpj: string
  emitIe?: string
  emitEndereco: string
  emitNumero?: string
  emitBairro?: string
  emitCidade: string
  emitUF: string
  emitCep?: string
  emitFone?: string
  emitEmail?: string
  emitCrt?: string

  destNome: string
  destCnpj: string
  destIe?: string
  destEndereco: string
  destBairro?: string
  destCidade: string
  destUF: string
  destCep?: string
  destFone?: string
  destEmail?: string

  faturaNumero?: string
  faturaValorOriginal?: number
  faturaValorDesconto?: number
  faturaValorLiquido?: number
  duplicatas?: { numero: string; vencimento: string; valor: number }[]

  items: {
    seq: number
    codigo: string
    descricao: string
    ncm?: string
    csosn?: string
    cfop?: string
    unit?: string
    qty: number
    unitPrice: number
    discount?: number
    total: number
    baseIcms?: number
    valorIcms?: number
    valorIpi?: number
    aliqIcms?: number
    aliqIpi?: number
    kind?: string
  }[]

  totalProdutos: number
  totalFrete: number
  totalSeguro?: number
  totalDesconto?: number
  totalOutras?: number
  totalIpi?: number
  totalNF: number
  billingAmount?: number | null
  valorAproxTributos?: number
  pctAproxTributos?: number

  modFrete?: string
  transportadora?: string
  cnpjTransportadora?: string
  ieTransportadora?: string
  endTransportadora?: string
  municipioTransportadora?: string
  ufTransportadora?: string
  vehiclePlate?: string
  vehicleUf?: string
  volumesQty?: number
  volumesSpecies?: string
  volumesMarca?: string
  volumesNumeracao?: string
  weightNet?: number
  weightGross?: number

  infoAdic?: string
  infoAdicBottom?: string  // texto ancorado na parte inferior do quadro (ICMS + tributos)
}

// ─── formatters ──────────────────────────────────────────────────────────────
const R = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(d: any): string {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('pt-BR')
}

function fmtHour(d: any): string {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtCnpj(s: string): string {
  const n = (s ?? '').replace(/\D/g, '')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return s ?? ''
}

function chaveFormatted(c?: string): string {
  if (!c) return 'Não disponível'
  return c.replace(/\D/g, '').match(/.{1,4}/g)?.join(' ') ?? c
}

const modFreteLabel: Record<string, string> = {
  '0': '0 - EMITENTE', '1': '1 - DESTINATARIO', '2': '2 - TERCEIROS',
  '3': '3 - PROPRIO REM', '4': '4 - PROPRIO DEST', '9': '9 - SEM FRETE',
}

function getLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src/modules/nfe-emit/utils/logo.png'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, '../../../..', 'logo.png'),
    path.join(process.cwd(), 'logo.png'),
  ]
  return candidates.find(p => { try { return fs.existsSync(p) } catch { return false } }) ?? null
}

// ─── A4 constants ─────────────────────────────────────────────────────────────
const PW = 595.28
const PH = 841.89
const ML = 14
const MR = 14
const CW = PW - ML - MR  // ~567

// ─── Drawing primitives ───────────────────────────────────────────────────────
function drawBox(doc: any, x: number, y: number, w: number, h: number, fill?: string) {
  if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, '#000')
  else doc.rect(x, y, w, h).stroke('#000')
}

function cellLabel(doc: any, txt: string, x: number, y: number, w: number) {
  doc.fontSize(5.5).font('Helvetica').fillColor('#000')
    .text(txt.toUpperCase(), x + 2, y + 2, { width: w - 4, lineBreak: false })
}

function cellValue(doc: any, txt: string, x: number, y: number, w: number, h: number, opts?: {
  bold?: boolean; fontSize?: number; align?: string; valignCenter?: boolean
}) {
  const fs = opts?.fontSize ?? 7.5
  const align = (opts?.align ?? 'left') as any
  // Label ocupa ~9pt no topo; valor fica centrado no espaço restante
  const labelH = 9
  const vy = y + labelH + Math.max((h - labelH - fs) / 2, 1)
  doc.fontSize(fs).font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000')
    .text(txt, x + 2, vy, { width: w - 4, lineBreak: false, align })
}

function cell(doc: any, lbl: string, val: string, x: number, y: number, w: number, h: number, opts?: {
  bold?: boolean; fontSize?: number; align?: string; labelOnly?: boolean
}) {
  drawBox(doc, x, y, w, h)
  cellLabel(doc, lbl, x, y, w)
  if (!opts?.labelOnly) cellValue(doc, val, x, y, w, h, opts)
}

function sectionHeader(doc: any, txt: string, x: number, y: number, w: number, h = 9) {
  // Apenas linhas superior e inferior — sem bordas laterais
  doc.moveTo(x, y).lineTo(x + w, y).stroke('#000')
  doc.moveTo(x, y + h).lineTo(x + w, y + h).stroke('#000')
  doc.fontSize(6).font('Helvetica-Bold').fillColor('#000')
    .text(txt, x + 3, y + 2, { width: w - 6, lineBreak: false })
}

// ─── Main PDF builder ─────────────────────────────────────────────────────────
export async function buildDanfePdf(d: DanfeData): Promise<Buffer> {
  // Pré-gera o barcode CODE-128 da chave de acesso (MOC NF-e 7.0 item 7.3.1)
  let barcodeBuffer: Buffer | null = null
  if (d.chaveAcesso) {
    try {
      barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: d.chaveAcesso.replace(/\s/g, ''),
        scale: 2,
        height: 10,
        includetext: false,
      })
    } catch { /* ignora se chave inválida — ex: DANFE de rascunho */ }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.lineWidth(0.4)

    const nfNum = String(d.number).padStart(9, '0')
    const serie = String(d.series).padStart(3, '0')
    const homolog = d.tpAmb !== '1'
    const logoPath = getLogoPath()

    // ── Pre-calculate item layout BEFORE drawing (needed for FOLHA N/M) ──────
    type Col = { label: string; w: number; align?: 'left' | 'center' | 'right' }
    const itCols: Col[] = [
      { label: 'CÓDIGO\nPRODUTO',               w: 40,  align: 'left'   },
      { label: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 140, align: 'left'   },
      { label: 'NCM/SH',                         w: 36,  align: 'center' },
      { label: 'COSN / CST',                     w: 22,  align: 'center' },
      { label: 'CFOP',                           w: 24,  align: 'center' },
      { label: 'UNID',                           w: 18,  align: 'center' },
      { label: 'QTDE.',                          w: 36,  align: 'right'  },
      { label: 'VALOR\nUNITÁRIO',               w: 40,  align: 'right'  },
      { label: 'VALOR\nDESCONTO',               w: 30,  align: 'right'  },
      { label: 'VALOR\nTOTAL',                  w: 38,  align: 'right'  },
      { label: 'BASE DE\nCÁLC. ICMS',           w: 34,  align: 'right'  },
      { label: 'VALOR\nICMS',                   w: 28,  align: 'right'  },
      { label: 'VALOR\nIPI',                    w: 24,  align: 'right'  },
      { label: 'ALÍQ. %\nICMS',                w: 18,  align: 'right'  },
      { label: 'ALÍQ. %\nIPI',                 w: 0,   align: 'right'  },
    ]
    const fixedItW = itCols.slice(0, -1).reduce((s, c) => s + c.w, 0)
    itCols[itCols.length - 1].w = CW - fixedItW

    const itemRowMinH = 13
    const colHdrH = 18
    const hdrH = 88
    const natH = 18
    const ieH = 18
    const footY_c = PH - 12
    const daH_c = 94
    const daBoxY_c = footY_c - daH_c
    const daSecY_c = daBoxY_c - 9
    const p2SectH = 9
    const p2StartY = homolog ? 24 : 10
    const p2TopY = p2StartY + hdrH + natH + ieH   // where sectionHeader starts on p2+
    const p2ItemsStartY = p2TopY + p2SectH + colHdrH  // where items start on p2+
    const p2ItemsSpace = PH - p2ItemsStartY - 15

    // Row heights
    doc.fontSize(6.5).font('Helvetica')
    const rowHeights: number[] = d.items.map(it =>
      [0, 1].reduce((maxH: number, i: number) => {
        const val = i === 0 ? it.codigo : it.descricao
        const h = doc.heightOfString(val, { width: itCols[i].w - 2 })
        return Math.max(maxH, h + 6)
      }, itemRowMinH)
    )

    // Approximate y where items start on page 1 (after all fixed sections)
    let approxY = 10
    if (homolog) approxY += 14
    approxY += 38 + 7   // canhoto + sep
    approxY += 88       // header
    approxY += 18 + 18  // natOp + IE
    approxY += 9 + 20 + 20 + 20  // destinatário
    approxY += 9 + 18 + 18       // imposto
    approxY += 9 + 20 + 20 + 20  // transportador
    approxY += 9                 // sectionHeader dados produtos
    // Fatura (optional, estimate 0 — conservative)

    const p1ItemsSpace = daSecY_c - approxY - colHdrH

    // Count total pages
    let totalPages = 1
    let spaceLeft = p1ItemsSpace
    for (const rh of rowHeights) {
      if (rh > spaceLeft) { totalPages++; spaceLeft = p2ItemsSpace }
      spaceLeft -= rh
    }

    let y = 10

    // ── HOMOLOGAÇÃO BANNER ──────────────────────────────────────────────────
    if (homolog) {
      drawBox(doc, ML, y, CW, 12, '#FFF3CD')
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#7B3F00')
        .text('SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO', ML, y + 2.5, { width: CW, align: 'center' })
      y += 14
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CANHOTO
    // ══════════════════════════════════════════════════════════════════════════
    const canhH = 38
    // border dashed
    doc.save()
    doc.rect(ML, y, CW, canhH).stroke('#000')
    doc.restore()

    // Receipt text (left ~68%)
    const receiptW = CW * 0.52
    const signW = CW * 0.27
    const nfBadgeW = CW - receiptW - signW

    doc.fontSize(6).font('Helvetica').fillColor('#000')
      .text(
        `Recebemos de ${d.emitFantasia || d.emitNome} os produtos e/ou serviços constantes da Nota Fiscal Eletrônica indicada ao lado.`,
        ML + 3, y + 3, { width: receiptW - 6, lineBreak: true }
      )
    doc.fontSize(6).fillColor('#000')
      .text(`Emissão: ${fmtDate(d.issuedAt)}   Dest/Reme: ${d.destNome}   Valor Total: ${R(d.totalNF)}`,
        ML + 3, y + 18, { width: receiptW - 6, lineBreak: false })

    // Data/Assinatura fields
    const sx = ML + receiptW
    drawBox(doc, sx, y, signW / 2, canhH)
    cellLabel(doc, 'DATA DO RECEBIMENTO', sx, y, signW / 2)
    drawBox(doc, sx + signW / 2, y, signW / 2, canhH)
    cellLabel(doc, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', sx + signW / 2, y, signW / 2)

    // NF badge
    const nbx = ML + receiptW + signW
    drawBox(doc, nbx, y, nfBadgeW, canhH)
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000')
      .text('NF-e', nbx, y + 3, { width: nfBadgeW, align: 'center' })
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
      .text(`Nº ${nfNum}`, nbx, y + 13, { width: nfBadgeW, align: 'center' })
    doc.fontSize(8).font('Helvetica').fillColor('#000')
      .text(`Série ${serie}`, nbx, y + 26, { width: nfBadgeW, align: 'center' })

    y += canhH

    // dotted separator
    doc.save()
    doc.moveTo(ML, y + 3).lineTo(ML + CW, y + 3)
      .dash(3, { space: 3 }).stroke('#555')
    doc.restore()
    y += 7

    // ══════════════════════════════════════════════════════════════════════════
    // HEADER — emitente | DANFE | chave
    // Layout: nome no topo → logo centralizado → endereço embaixo
    // ══════════════════════════════════════════════════════════════════════════
    const emitW = CW * 0.42
    const danfeW = CW * 0.18
    const chaveW = CW - emitW - danfeW

    const fmtCep = (s?: string) => s ? s.replace(/(\d{5})(\d{3})/, '$1-$2') : ''
    const fmtPhone = (s?: string) => {
      if (!s) return ''
      const n = s.replace(/\D/g, '')
      return n.length === 10 ? n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3') :
             n.length === 11 ? n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : s
    }

    // ── Emitente block ────────────────────────────────────────────────────────
    drawBox(doc, ML, y, emitW, hdrH)

    const nameH = 14   // espaço para nome no topo
    const addrH = 30   // espaço para endereço embaixo
    const logoAreaH = hdrH - nameH - addrH
    const logoAreaW = emitW - 12

    // 1. Nome completo no topo
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
      .text(d.emitNome, ML + 3, y + 3, { width: emitW - 6, align: 'center', lineBreak: false })

    // 2. Logo centralizado na área do meio
    if (logoPath) {
      try {
        doc.image(logoPath, ML + 6, y + nameH, { fit: [logoAreaW, logoAreaH], align: 'center', valign: 'center' })
      } catch { /* skip */ }
    }

    // 3. Endereço embaixo
    const addrY = y + hdrH - addrH + 2
    doc.fontSize(6.5).font('Helvetica').fillColor('#000')
      .text(`${d.emitEndereco}${d.emitNumero ? ', ' + d.emitNumero : ''}`, ML + 3, addrY, { width: emitW - 6, align: 'center', lineBreak: false })
    doc.fontSize(6.5).font('Helvetica').fillColor('#000')
      .text(`${d.emitBairro ? d.emitBairro + ' - ' : ''}${d.emitCidade} - ${d.emitUF}`, ML + 3, addrY + 8, { width: emitW - 6, align: 'center', lineBreak: false })
    doc.fontSize(6.5).font('Helvetica').fillColor('#000')
      .text(`Fone: ${fmtPhone(d.emitFone)}   CEP: ${fmtCep(d.emitCep)}`, ML + 3, addrY + 16, { width: emitW - 6, align: 'center', lineBreak: false })

    // ── DANFE block (center) ──────────────────────────────────────────────────
    const dx = ML + emitW
    drawBox(doc, dx, y, danfeW, hdrH)
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000')
      .text('DANFE', dx, y + 6, { width: danfeW, align: 'center' })
    doc.fontSize(6.5).font('Helvetica').fillColor('#000')
      .text('Documento Auxiliar da\nNota Fiscal Eletrônica', dx, y + 26, { width: danfeW, align: 'center' })

    // 0-ENTRADA / 1-SAÍDA indicator
    const indX = dx + danfeW / 2 - 28
    const indY = y + 44
    doc.fontSize(6).font('Helvetica').fillColor('#000').text('0 - ENTRADA', indX, indY, { lineBreak: false })
    doc.fontSize(6).text('1 - SAÍDA', indX, indY + 8, { lineBreak: false })
    drawBox(doc, indX + 52, indY, 14, 14)
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
      .text('1', indX + 52, indY + 2, { width: 14, align: 'center' })

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
      .text(`Nº ${nfNum}`, dx, y + 63, { width: danfeW, align: 'center' })
    doc.fontSize(7.5).font('Helvetica').fillColor('#000')
      .text(`SÉRIE ${serie}   FOLHA 1/${totalPages}`, dx, y + 75, { width: danfeW, align: 'center' })

    // ── Chave de acesso block (direita) ───────────────────────────────────────
    // Layout (topo→base): 3 boxes dividindo hdrH igualmente
    //   [box 1] barcode — sem título
    //   [box 2] "CHAVE DE ACESSO" + números formatados
    //   [box 3] texto consulta — espaço restante
    const chaveX = ML + emitW + danfeW
    const barcodeBoxH = Math.round(hdrH / 3)
    const chaveNumH = Math.round(hdrH / 3)
    const consultaH = hdrH - barcodeBoxH - chaveNumH

    // Box 1: barcode sem título
    drawBox(doc, chaveX, y, chaveW, barcodeBoxH)
    if (barcodeBuffer) {
      doc.image(barcodeBuffer, chaveX + 3, y + 2, { width: chaveW - 6, height: barcodeBoxH - 4 })
    }

    // Box 2: título "CHAVE DE ACESSO" + números
    drawBox(doc, chaveX, y + barcodeBoxH, chaveW, chaveNumH)
    doc.fontSize(5.5).font('Helvetica').fillColor('#000')
      .text('CHAVE DE ACESSO', chaveX + 3, y + barcodeBoxH + 2, { width: chaveW - 6, lineBreak: false })
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
      .text(chaveFormatted(d.chaveAcesso), chaveX + 3, y + barcodeBoxH + 9, { width: chaveW - 6, align: 'center' })

    // Box 3: consulta — ocupa espaço restante
    drawBox(doc, chaveX, y + barcodeBoxH + chaveNumH, chaveW, consultaH)
    doc.fontSize(5.5).font('Helvetica').fillColor('#000')
      .text('Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora',
        chaveX + 3, y + barcodeBoxH + chaveNumH + 2, { width: chaveW - 6, align: 'center' })

    y += hdrH

    // ── NATUREZA DA OPERAÇÃO + PROTOCOLO ────────────────────────────────────
    const natW = CW * 0.60
    const protW = CW - natW

    cell(doc, 'NATUREZA DA OPERAÇÃO', d.naturezaOperacao.toUpperCase(), ML, y, natW, natH)
    cell(doc, 'PROTOCOLO DE AUTORIZAÇÃO DE USO',
      d.protocol ? `${d.protocol}  ${fmtDate(d.issuedAt)} ${fmtHour(d.issuedAt)}` : 'NÃO AUTORIZADO / HOMOLOGAÇÃO',
      ML + natW, y, protW, natH, { fontSize: 7 })
    y += natH

    // ── IE + IE SUBST + CNPJ ────────────────────────────────────────────────
    const ieW = CW * 0.33
    const ieSubW = CW * 0.33
    const cnpjW = CW - ieW - ieSubW
    cell(doc, 'INSCRIÇÃO ESTADUAL', d.emitIe ?? '', ML, y, ieW, ieH)
    cell(doc, 'INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO', '', ML + ieW, y, ieSubW, ieH)
    cell(doc, 'CNPJ', fmtCnpj(d.emitCnpj), ML + ieW + ieSubW, y, cnpjW, ieH)
    y += ieH

    // ══════════════════════════════════════════════════════════════════════════
    // DESTINATÁRIO
    // ══════════════════════════════════════════════════════════════════════════
    sectionHeader(doc, 'DESTINATÁRIO / REMETENTE', ML, y, CW)
    y += 9

    const dR1H = 20
    const nomeW = CW * 0.52
    const cnpjDW = CW * 0.24
    const emissaoW = CW - nomeW - cnpjDW
    cell(doc, 'NOME / RAZÃO SOCIAL', d.destNome, ML, y, nomeW, dR1H, { bold: true })
    cell(doc, 'CNPJ / CPF', fmtCnpj(d.destCnpj), ML + nomeW, y, cnpjDW, dR1H)
    cell(doc, 'DATA DA EMISSÃO', fmtDate(d.issuedAt), ML + nomeW + cnpjDW, y, emissaoW, dR1H)
    y += dR1H

    const dR2H = 20
    const endW = CW * 0.38
    const bairroW = CW * 0.22
    const cepW = CW * 0.15
    const saidaW = CW - endW - bairroW - cepW
    cell(doc, 'ENDEREÇO', d.destEndereco, ML, y, endW, dR2H)
    cell(doc, 'BAIRRO / DISTRITO', d.destBairro ?? '', ML + endW, y, bairroW, dR2H)
    cell(doc, 'CEP', d.destCep ?? '', ML + endW + bairroW, y, cepW, dR2H)
    cell(doc, 'DATA DA SAÍDA', fmtDate(d.issuedAt), ML + endW + bairroW + cepW, y, saidaW, dR2H)
    y += dR2H

    const dR3H = 20
    const munW = CW * 0.28
    const ufW = CW * 0.06
    const telW = CW * 0.18
    const ieDestW = CW * 0.22
    const horW = CW - munW - ufW - telW - ieDestW
    cell(doc, 'MUNICÍPIO', d.destCidade, ML, y, munW, dR3H)
    cell(doc, 'UF', d.destUF, ML + munW, y, ufW, dR3H)
    cell(doc, 'TELEFONE / FAX', d.destFone ?? '', ML + munW + ufW, y, telW, dR3H)
    cell(doc, 'INSCRIÇÃO ESTADUAL', d.destIe ?? '', ML + munW + ufW + telW, y, ieDestW, dR3H)
    cell(doc, 'HORA DA SAÍDA', fmtHour(d.issuedAt), ML + munW + ufW + telW + ieDestW, y, horW, dR3H)
    y += dR3H

    // ══════════════════════════════════════════════════════════════════════════
    // FATURA + DUPLICATAS (optional)
    // ══════════════════════════════════════════════════════════════════════════
    if (d.faturaNumero || (d.duplicatas && d.duplicatas.length > 0)) {
      sectionHeader(doc, 'FATURA', ML, y, CW)
      y += 9

      const fatH = 16
      const fatTxt = d.faturaNumero
        ? `DADOS DA FATURA - Número: ${d.faturaNumero} - Valor Original: R$ ${R(d.faturaValorOriginal ?? d.totalNF)} - Valor Desconto: R$ ${R(d.faturaValorDesconto ?? 0)} - Valor Líquido: R$ ${R(d.faturaValorLiquido ?? d.totalNF)}`
        : ''
      drawBox(doc, ML, y, CW, fatH)
      doc.fontSize(7).font('Helvetica').fillColor('#000')
        .text(fatTxt, ML + 3, y + 5, { width: CW - 6, lineBreak: false })
      y += fatH

      if (d.duplicatas && d.duplicatas.length > 0) {
        const dupH = 8
        sectionHeader(doc, 'DUPLICATAS', ML, y, CW, dupH)
        y += dupH

        // Header
        const dupRowH = 14
        const dColW = CW / 3
        drawBox(doc, ML, y, dColW, dupRowH, '#EEEEEE')
        drawBox(doc, ML + dColW, y, dColW, dupRowH, '#EEEEEE')
        drawBox(doc, ML + dColW * 2, y, dColW, dupRowH, '#EEEEEE')
        doc.fontSize(6).font('Helvetica-Bold').fillColor('#000')
          .text('Número', ML + 3, y + 4, { lineBreak: false })
          .text('Vencimento', ML + dColW + 3, y + 4, { lineBreak: false })
          .text('Valor', ML + dColW * 2 + 3, y + 4, { lineBreak: false })
        y += dupRowH

        for (const dup of d.duplicatas) {
          drawBox(doc, ML, y, dColW, dupRowH)
          drawBox(doc, ML + dColW, y, dColW, dupRowH)
          drawBox(doc, ML + dColW * 2, y, dColW, dupRowH)
          doc.fontSize(7).font('Helvetica').fillColor('#000')
            .text(`: ${dup.numero}`, ML + 3, y + 4, { lineBreak: false })
            .text(`: ${dup.vencimento}`, ML + dColW + 3, y + 4, { lineBreak: false })
            .text(`: R$${R(dup.valor)}`, ML + dColW * 2 + 3, y + 4, { lineBreak: false })
          y += dupRowH
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CÁLCULO DO IMPOSTO
    // ══════════════════════════════════════════════════════════════════════════
    sectionHeader(doc, 'CÁLCULO DO IMPOSTO', ML, y, CW)
    y += 9

    const impH = 18
    // Row 1: Base ICMS | Valor ICMS | Base ICMS Subst | Valor ICMS Subst | V.Aprox Tributos | Valor Total Produtos
    const iW = CW / 6
    cell(doc, 'BASE DE CÁLCULO DO ICMS', '0,00', ML, y, iW, impH, { align: 'right' })
    cell(doc, 'VALOR DO ICMS', '0,00', ML + iW, y, iW, impH, { align: 'right' })
    cell(doc, 'BASE DE CÁLCULO DO ICMS SUBST.', '0,00', ML + iW * 2, y, iW, impH, { align: 'right' })
    cell(doc, 'VALOR DO ICMS SUBST.', '0,00', ML + iW * 3, y, iW, impH, { align: 'right' })

    const tribTxt = d.valorAproxTributos != null
      ? `${R(d.valorAproxTributos)} (${d.pctAproxTributos?.toFixed(2) ?? '0,00'} %)`
      : ''
    cell(doc, 'V.APROX. TRIBUTOS', tribTxt, ML + iW * 4, y, iW, impH, { align: 'right' })
    cell(doc, 'VALOR TOTAL DOS PRODUTOS', R(d.totalProdutos), ML + iW * 5, y, iW, impH, { align: 'right', bold: true })
    y += impH

    // Row 2: Frete | Seguro | Desconto | Outras | IPI | Total NF
    cell(doc, 'VALOR DO FRETE', R(d.totalFrete), ML, y, iW, impH, { align: 'right' })
    cell(doc, 'VALOR DO SEGURO', R(d.totalSeguro ?? 0), ML + iW, y, iW, impH, { align: 'right' })
    cell(doc, 'DESCONTO', R(d.totalDesconto ?? 0), ML + iW * 2, y, iW, impH, { align: 'right' })
    cell(doc, 'OUTRAS DESPESAS ACESSÓRIAS', R(d.totalOutras ?? 0), ML + iW * 3, y, iW, impH, { align: 'right' })
    cell(doc, 'VALOR DO IPI', R(d.totalIpi ?? 0), ML + iW * 4, y, iW, impH, { align: 'right' })
    cell(doc, 'VALOR TOTAL DA NOTA', R(d.totalNF), ML + iW * 5, y, iW, impH, { align: 'right', bold: true })
    y += impH

    // ══════════════════════════════════════════════════════════════════════════
    // TRANSPORTADOR / VOLUMES
    // ══════════════════════════════════════════════════════════════════════════
    sectionHeader(doc, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', ML, y, CW)
    y += 9

    const tH1 = 20
    // Row 1: Nome transportadora | Frete por Conta | Cód ANTT | Placa | UF | CNPJ
    const tNomeW = CW * 0.28
    const tFreteW = CW * 0.16
    const tAnttW = CW * 0.10
    const tPlacaW = CW * 0.12
    const tUfW = CW * 0.06
    const tCnpjW = CW - tNomeW - tFreteW - tAnttW - tPlacaW - tUfW
    cell(doc, 'NOME / RAZÃO SOCIAL', d.transportadora ?? '', ML, y, tNomeW, tH1)
    cell(doc, 'FRETE POR CONTA', modFreteLabel[d.modFrete ?? '1'] ?? '', ML + tNomeW, y, tFreteW, tH1)
    cell(doc, 'CÓDIGO ANTT', '', ML + tNomeW + tFreteW, y, tAnttW, tH1)
    cell(doc, 'PLACA DO VEÍCULO', d.vehiclePlate ?? '', ML + tNomeW + tFreteW + tAnttW, y, tPlacaW, tH1)
    cell(doc, 'UF', d.vehicleUf ?? '', ML + tNomeW + tFreteW + tAnttW + tPlacaW, y, tUfW, tH1)
    cell(doc, 'CNPJ / CPF', d.cnpjTransportadora ? fmtCnpj(d.cnpjTransportadora) : '', ML + tNomeW + tFreteW + tAnttW + tPlacaW + tUfW, y, tCnpjW, tH1)
    y += tH1

    // Row 2: Endereço | Município | UF | IE
    const tH2 = 20
    const tEndW = CW * 0.38
    const tMunW = CW * 0.28
    const tUf2W = CW * 0.08
    const tIeW = CW - tEndW - tMunW - tUf2W
    cell(doc, 'ENDEREÇO', d.endTransportadora ?? '', ML, y, tEndW, tH2)
    cell(doc, 'MUNICÍPIO', d.municipioTransportadora ?? '', ML + tEndW, y, tMunW, tH2)
    cell(doc, 'UF', d.ufTransportadora ?? '', ML + tEndW + tMunW, y, tUf2W, tH2)
    cell(doc, 'INSCRIÇÃO ESTADUAL', d.ieTransportadora ?? '', ML + tEndW + tMunW + tUf2W, y, tIeW, tH2)
    y += tH2

    // Row 3: Qtd | Espécie | Marca | Numeração | Peso Bruto | Peso Líquido
    const tH3 = 20
    const tQtdW = CW * 0.08
    const tEspW = CW * 0.14
    const tMarcaW = CW * 0.16
    const tNumW = CW * 0.18
    const tPbW = CW * 0.22
    const tPlW = CW - tQtdW - tEspW - tMarcaW - tNumW - tPbW
    cell(doc, 'QUANTIDADE', d.volumesQty != null ? String(d.volumesQty) : '', ML, y, tQtdW, tH3, { align: 'center' })
    cell(doc, 'ESPÉCIE', d.volumesSpecies ?? '', ML + tQtdW, y, tEspW, tH3)
    cell(doc, 'MARCA', d.volumesMarca ?? '', ML + tQtdW + tEspW, y, tMarcaW, tH3)
    cell(doc, 'NUMERAÇÃO', d.volumesNumeracao ?? '', ML + tQtdW + tEspW + tMarcaW, y, tNumW, tH3)
    cell(doc, 'PESO BRUTO', d.weightGross != null ? d.weightGross.toFixed(3) : '', ML + tQtdW + tEspW + tMarcaW + tNumW, y, tPbW, tH3, { align: 'right' })
    cell(doc, 'PESO LÍQUIDO', d.weightNet != null ? d.weightNet.toFixed(3) : '', ML + tQtdW + tEspW + tMarcaW + tNumW + tPbW, y, tPlW, tH3, { align: 'right' })
    y += tH3

    // ══════════════════════════════════════════════════════════════════════════
    // DADOS DOS PRODUTOS / SERVIÇOS — multi-page
    // ══════════════════════════════════════════════════════════════════════════
    sectionHeader(doc, 'DADOS DOS PRODUTOS / SERVIÇOS', ML, y, CW)
    y += 9

    // ── helpers ────────────────────────────────────────────────────────────
    const DESCR_IDX = 1

    function drawColHeader(cy: number) {
      drawBox(doc, ML, cy, CW, colHdrH)
      let cx = ML
      for (const c of itCols) {
        doc.rect(cx, cy, c.w, colHdrH).stroke()
        doc.fontSize(5).font('Helvetica-Bold').fillColor('#000')
          .text(c.label, cx + 1, cy + 2, { width: c.w - 2, align: 'center', lineBreak: true, height: colHdrH - 2 })
        cx += c.w
      }
    }

    function drawItemRow(it: typeof d.items[0], rowH: number, iy: number) {
      const vals: string[] = [
        it.codigo, it.descricao, it.ncm ?? '', it.csosn ?? '', it.cfop ?? '', it.unit ?? '',
        it.qty.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        R(it.unitPrice), R(it.discount ?? 0), R(it.total),
        R(it.baseIcms ?? 0), R(it.valorIcms ?? 0), R(it.valorIpi ?? 0),
        it.aliqIcms != null ? it.aliqIcms.toFixed(2) : '0,00',
        it.aliqIpi != null ? it.aliqIpi.toFixed(2) : '0,00',
      ]
      drawBox(doc, ML, iy, CW, rowH)
      let cx = ML
      for (let i = 0; i < itCols.length; i++) {
        doc.rect(cx, iy, itCols[i].w, rowH).stroke()
        const isBold = i === 9
        doc.fontSize(6.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000')
        const canWrap = i === 0 || i === DESCR_IDX
        if (canWrap) {
          doc.text(vals[i], cx + 1, iy + 3, { width: itCols[i].w - 2, align: itCols[i].align ?? 'left', lineBreak: true, height: rowH - 4 })
        } else {
          doc.text(vals[i], cx + 1, iy + Math.max((rowH / 2) - 3, 3), { width: itCols[i].w - 2, align: itCols[i].align ?? 'left', lineBreak: false })
        }
        cx += itCols[i].w
      }
    }

    function drawDadosAdicionais() {
      const footY = PH - 12
      const daBoxY = footY - daH_c
      const daSecY = daBoxY - 9
      sectionHeader(doc, 'DADOS ADICIONAIS', ML, daSecY, CW)
      const infW = CW * 0.65
      const fiscW = CW - infW
      drawBox(doc, ML, daBoxY, infW, daH_c)
      drawBox(doc, ML + infW, daBoxY, fiscW, daH_c)
      cellLabel(doc, 'INFORMAÇÕES COMPLEMENTARES', ML, daBoxY, infW)
      cellLabel(doc, 'RESERVADO AO FISCO', ML + infW, daBoxY, fiscW)
      if (d.infoAdic) {
        doc.fontSize(6.5).font('Helvetica').fillColor('#000')
          .text(d.infoAdic, ML + 3, daBoxY + 9, { width: infW - 6, lineBreak: true })
      }
      // Texto ancorado na base do quadro (ICMS + tributos)
      if (d.infoAdicBottom) {
        const bottomLines = d.infoAdicBottom.trim().split('\n')
        const lineH = 8
        const totalH = bottomLines.length * lineH
        const anchorY = daBoxY + daH_c - totalH - 4
        doc.fontSize(6.5).font('Helvetica').fillColor('#000')
          .text(d.infoAdicBottom, ML + 3, anchorY, { width: infW - 6, lineBreak: true })
      }
      doc.fontSize(6).font('Helvetica').fillColor('#555')
        .text(
          `Gerado por Tapajós ERP   |   DATA E HORA DA IMPRESSÃO: ${new Date().toLocaleString('pt-BR')}`,
          ML, footY, { width: CW, align: 'center', lineBreak: false }
        )
    }

    // Continuation page: full header (same as page 1) + natOp + IE rows
    function drawContPage(pageNum: number) {
      let cy = 10
      if (homolog) {
        drawBox(doc, ML, 0, CW, 12, '#FFF3CD')
        doc.fontSize(6).font('Helvetica-Bold').fillColor('#7B3F00')
          .text('SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO', ML, 1.5, { width: CW, align: 'center' })
        cy = 24
      }

      // ── Emitente block (identical to page 1) ─────────────────────────────────
      drawBox(doc, ML, cy, emitW, hdrH)
      const nameH2 = 14
      const addrH2 = 30
      const logoAreaH2 = hdrH - nameH2 - addrH2
      const logoAreaW2 = emitW - 12
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
        .text(d.emitNome, ML + 3, cy + 3, { width: emitW - 6, align: 'center', lineBreak: false })
      if (logoPath) {
        try { doc.image(logoPath, ML + 6, cy + nameH2, { fit: [logoAreaW2, logoAreaH2], align: 'center', valign: 'center' }) } catch { /* skip */ }
      }
      const addrY2 = cy + hdrH - addrH2 + 2
      doc.fontSize(6.5).font('Helvetica').fillColor('#000')
        .text(`${d.emitEndereco}${d.emitNumero ? ', ' + d.emitNumero : ''}`, ML + 3, addrY2, { width: emitW - 6, align: 'center', lineBreak: false })
      doc.fontSize(6.5).font('Helvetica').fillColor('#000')
        .text(`${d.emitBairro ? d.emitBairro + ' - ' : ''}${d.emitCidade} - ${d.emitUF}`, ML + 3, addrY2 + 8, { width: emitW - 6, align: 'center', lineBreak: false })
      doc.fontSize(6.5).font('Helvetica').fillColor('#000')
        .text(`Fone: ${fmtPhone(d.emitFone)}   CEP: ${fmtCep(d.emitCep)}`, ML + 3, addrY2 + 16, { width: emitW - 6, align: 'center', lineBreak: false })

      // ── DANFE block ───────────────────────────────────────────────────────────
      const dx2 = ML + emitW
      drawBox(doc, dx2, cy, danfeW, hdrH)
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000')
        .text('DANFE', dx2, cy + 6, { width: danfeW, align: 'center' })
      doc.fontSize(6.5).font('Helvetica').fillColor('#000')
        .text('Documento Auxiliar da\nNota Fiscal Eletrônica', dx2, cy + 26, { width: danfeW, align: 'center' })
      const indX2 = dx2 + danfeW / 2 - 28
      const indY2 = cy + 44
      doc.fontSize(6).font('Helvetica').fillColor('#000').text('0 - ENTRADA', indX2, indY2, { lineBreak: false })
      doc.fontSize(6).text('1 - SAÍDA', indX2, indY2 + 8, { lineBreak: false })
      drawBox(doc, indX2 + 52, indY2, 14, 14)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
        .text('1', indX2 + 52, indY2 + 2, { width: 14, align: 'center' })
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
        .text(`Nº ${nfNum}`, dx2, cy + 63, { width: danfeW, align: 'center' })
      doc.fontSize(7.5).font('Helvetica').fillColor('#000')
        .text(`SÉRIE ${serie}   FOLHA ${pageNum}/${totalPages}`, dx2, cy + 75, { width: danfeW, align: 'center' })

      // ── Chave de acesso block ─────────────────────────────────────────────────
      // Mesmo layout da página 1: 3 boxes dividindo hdrH igualmente
      const chaveX2 = ML + emitW + danfeW
      const barcodeBoxH2 = Math.round(hdrH / 3)
      const chaveNumH2 = Math.round(hdrH / 3)
      const consultaH2 = hdrH - barcodeBoxH2 - chaveNumH2
      // Box 1: barcode
      drawBox(doc, chaveX2, cy, chaveW, barcodeBoxH2)
      if (barcodeBuffer) {
        doc.image(barcodeBuffer, chaveX2 + 3, cy + 2, { width: chaveW - 6, height: barcodeBoxH2 - 4 })
      }
      // Box 2: CHAVE DE ACESSO
      drawBox(doc, chaveX2, cy + barcodeBoxH2, chaveW, chaveNumH2)
      doc.fontSize(5.5).font('Helvetica').fillColor('#000')
        .text('CHAVE DE ACESSO', chaveX2 + 3, cy + barcodeBoxH2 + 2, { width: chaveW - 6, lineBreak: false })
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
        .text(chaveFormatted(d.chaveAcesso), chaveX2 + 3, cy + barcodeBoxH2 + 9, { width: chaveW - 6, align: 'center' })
      // Box 3: consulta
      drawBox(doc, chaveX2, cy + barcodeBoxH2 + chaveNumH2, chaveW, consultaH2)
      doc.fontSize(5.5).font('Helvetica').fillColor('#000')
        .text('Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora',
          chaveX2 + 3, cy + barcodeBoxH2 + chaveNumH2 + 2, { width: chaveW - 6, align: 'center' })
      cy += hdrH

      // ── NatOp + Protocolo ─────────────────────────────────────────────────────
      const natW2 = CW * 0.60
      const protW2 = CW - natW2
      cell(doc, 'NATUREZA DA OPERAÇÃO', d.naturezaOperacao.toUpperCase(), ML, cy, natW2, natH)
      cell(doc, 'PROTOCOLO DE AUTORIZAÇÃO DE USO',
        d.protocol ? `${d.protocol}  ${fmtDate(d.issuedAt)} ${fmtHour(d.issuedAt)}` : 'NÃO AUTORIZADO / HOMOLOGAÇÃO',
        ML + natW2, cy, protW2, natH, { fontSize: 7 })
      cy += natH

      // ── IE + CNPJ ─────────────────────────────────────────────────────────────
      const ieW2 = CW * 0.33
      const ieSubW2 = CW * 0.33
      const cnpjW2 = CW - ieW2 - ieSubW2
      cell(doc, 'INSCRIÇÃO ESTADUAL', d.emitIe ?? '', ML, cy, ieW2, ieH)
      cell(doc, 'INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO', '', ML + ieW2, cy, ieSubW2, ieH)
      cell(doc, 'CNPJ', fmtCnpj(d.emitCnpj), ML + ieW2 + ieSubW2, cy, cnpjW2, ieH)
      cy += ieH

      // ── Section header for continuation ──────────────────────────────────────
      sectionHeader(doc, 'DADOS DOS PRODUTOS / SERVIÇOS (CONTINUAÇÃO)', ML, cy, CW)
    }

    // ── Distribute items across pages ────────────────────────────────────────
    interface PageRange { start: number; end: number }
    const pageRanges: PageRange[] = []
    let pStart = 0
    let spLeft = daSecY_c - y - colHdrH  // page 1: space after colHeader
    for (let i = 0; i < rowHeights.length; i++) {
      if (rowHeights[i] > spLeft && i > pStart) {
        pageRanges.push({ start: pStart, end: i })
        pStart = i
        spLeft = p2ItemsSpace - rowHeights[i]
      } else {
        spLeft -= rowHeights[i]
      }
    }
    pageRanges.push({ start: pStart, end: d.items.length })

    // ── Draw pages ───────────────────────────────────────────────────────────
    for (let pg = 0; pg < pageRanges.length; pg++) {
      const { start, end } = pageRanges[pg]
      const pageNum = pg + 1

      if (pg === 0) {
        // Page 1: items then dados adicionais fixed at bottom
        drawColHeader(y)
        y += colHdrH
        for (let i = start; i < end; i++) {
          drawItemRow(d.items[i], rowHeights[i], y)
          y += rowHeights[i]
        }
        drawDadosAdicionais()
      } else {
        // Continuation page: full header + natOp + IE + items
        doc.addPage()
        drawContPage(pageNum)
        y = p2ItemsStartY
        drawColHeader(y)
        y += colHdrH
        for (let i = start; i < end; i++) {
          drawItemRow(d.items[i], rowHeights[i], y)
          y += rowHeights[i]
        }
        // Footer with page number only (no dados adicionais)
        doc.fontSize(6).font('Helvetica').fillColor('#555')
          .text(
            `Gerado por Tapajós ERP   |   FOLHA ${pageNum}/${totalPages}   |   ${new Date().toLocaleString('pt-BR')}`,
            ML, PH - 12, { width: CW, align: 'center', lineBreak: false }
          )
      }
    }

    // ── Marca d'água HOMOLOGAÇÃO em todas as páginas ────────────────────────
    if (homolog) {
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i)
        doc.save()
        doc.opacity(0.07)
        doc.fontSize(72).font('Helvetica-Bold').fillColor('#FF0000')
        doc.rotate(-45, { origin: [PW / 2, PH / 2] })
        doc.text('HOMOLOGAÇÃO', 0, PH / 2 - 36, { width: PW, align: 'center', lineBreak: false })
        doc.restore()
      }
    }

    doc.end()
  })
}

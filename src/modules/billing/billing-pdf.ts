// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as typeof import('pdfkit')
import * as fs from 'fs'
import * as path from 'path'

export interface BillingPdfData {
  faturaNumero: number | string
  emissao: Date | string
  vencimento: Date | string
  pago?: boolean
  pagamentoData?: Date | string | null

  // Emitente
  emitNome: string
  emitFantasia?: string
  emitEndereco: string
  emitFone?: string
  emitFax?: string
  emitEmail?: string
  emitCnpj: string
  emitIe?: string
  emitBanco?: string
  emitAgencia?: string
  emitConta?: string

  // Sacado (cliente)
  sacadoNome: string
  sacadoEndereco: string
  sacadoBairro?: string
  sacadoCidade: string
  sacadoEstado: string
  sacadoEndCobranca?: string
  sacadoCep: string
  sacadoCnpj: string
  sacadoIe?: string

  // NFs referenciadas
  nfs: { data: string; numero: string | number; valor: number }[]

  totalAmount: number
}

// ─── Número por extenso (pt-BR) ───────────────────────────────────────────────
const UNIDADES = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE',
  'DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE']
const DEZENAS = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA']
const CENTENAS = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS',
  'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS']

function inteiroExtenso(n: number): string {
  if (n === 0) return 'ZERO'
  if (n === 100) return 'CEM'
  if (n < 20) return UNIDADES[n]
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} E ${UNIDADES[u]}`
  }
  if (n < 1000) {
    const c = Math.floor(n / 100), resto = n % 100
    return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} E ${inteiroExtenso(resto)}`
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000), resto = n % 1000
    const milLabel = mil === 1 ? 'MIL' : `${inteiroExtenso(mil)} MIL`
    return resto === 0 ? milLabel : `${milLabel} E ${inteiroExtenso(resto)}`
  }
  return String(n)
}

export function valorPorExtenso(valor: number): string {
  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)
  const reais = inteiro === 1
    ? `${inteiroExtenso(inteiro)} REAL`
    : `${inteiroExtenso(inteiro)} REAIS`
  if (centavos === 0) return reais
  const cLabel = centavos === 1 ? `${inteiroExtenso(centavos)} CENTAVO` : `${inteiroExtenso(centavos)} CENTAVOS`
  return `${reais} E ${cLabel}`
}

function R(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: any): string {
  if (!d) return ''
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

function fmtCnpj(s: string): string {
  const n = (s ?? '').replace(/\D/g, '')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return s ?? ''
}

function getLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src/modules/nfe-emit/utils/logo.png'),
    path.join(__dirname, '../nfe-emit/utils/logo.png'),
    path.join(__dirname, 'logo.png'),
    path.join(process.cwd(), 'logo.png'),
  ]
  return candidates.find(p => { try { return fs.existsSync(p) } catch { return false } }) ?? null
}

// ─── PDF builder ──────────────────────────────────────────────────────────────
// A4 = 595.28 x 841.89 pt
const PW = 595.28
const ML = 20
const MR = 20
const CW = PW - ML - MR  // ~555

export function buildBillingPdf(d: BillingPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const logoPath = getLogoPath()
    let y = 20

    // ── HEADER ────────────────────────────────────────────────────────────────
    const hdrH = 68
    const logoW = 80
    const textX = ML + logoW + 10
    const textW = CW - logoW - 10

    doc.rect(ML, y, CW, hdrH).stroke('#000')
    // Logo — fit para não ultrapassar a borda do quadro
    if (logoPath) {
      try {
        doc.image(logoPath, ML + 2, y + 2, { fit: [logoW - 4, hdrH - 6], align: 'center', valign: 'center' })
      } catch { /* skip */ }
    }
    // Vertical separator
    doc.moveTo(ML + logoW, y).lineTo(ML + logoW, y + hdrH).stroke('#000')

    // Company name
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000')
      .text((d.emitFantasia || d.emitNome).toUpperCase(), textX, y + 6, { width: textW - 4, align: 'center' })

    doc.fontSize(8.5).font('Helvetica').fillColor('#000')
    const ey = y + 26
    doc.text(`Endereço: ${d.emitEndereco}`, textX, ey, { width: textW - 4, align: 'center' })
    doc.text(
      `Fone: ${d.emitFone ?? ''}    Fax: ${d.emitFax ?? ''}    E-mail: ${d.emitEmail ?? ''}`,
      textX, ey + 11, { width: textW - 4, align: 'center' }
    )
    doc.text(
      `CNPJ: ${fmtCnpj(d.emitCnpj)}    Inscrição Estadual: ${d.emitIe ?? ''}`,
      textX, ey + 22, { width: textW - 4, align: 'center' }
    )
    if (d.emitBanco) {
      doc.text(
        `Dados Bancários: ${d.emitBanco}    Agência ${d.emitAgencia ?? ''}    Conta corrente ${d.emitConta ?? ''}`,
        textX, ey + 33, { width: textW - 4, align: 'center' }
      )
    }
    y += hdrH + 6

    // ── FAIXA: DATA EMISSÃO | FATURA Nº | DATA VENCIMENTO | VALOR COBRADO ───
    const row1H = 26
    const c1w = CW * 0.18
    const c2w = CW * 0.20
    const c3w = CW * 0.36
    const c4w = CW - c1w - c2w - c3w

    function infoCell(lbl: string, val: string, x: number, yy: number, w: number) {
      doc.rect(x, yy, w, row1H).stroke('#000')
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#000')
        .text(lbl, x + 4, yy + 3, { width: w - 8, lineBreak: false })
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
        .text(val, x + 4, yy + 13, { width: w - 8, align: 'center', lineBreak: false })
    }

    infoCell('DATA DE EMISSÃO', fmtDate(d.emissao), ML, y, c1w)
    infoCell('FATURA Nº', String(d.faturaNumero), ML + c1w, y, c2w)
    infoCell('DATA DE VENCIMENTO', fmtDate(d.vencimento), ML + c1w + c2w, y, c3w)
    infoCell('VALOR COBRADO', `R$  ${R(d.totalAmount)}`, ML + c1w + c2w + c3w, y, c4w)
    y += row1H + 4

    // ── MAIN BODY — left (60%) + right (40%) ─────────────────────────────────
    const leftW = CW * 0.60
    const rightW = CW - leftW

    // Estimate body height
    const nfRows = Math.max(d.nfs.length, 8)
    const bodyH = Math.max(
      240,
      nfRows * 14 + 80,
    )

    // Draw outer boxes
    doc.rect(ML, y, leftW, bodyH).stroke('#000')
    doc.rect(ML + leftW, y, rightW, bodyH).stroke('#000')

    // ── LEFT side ────────────────────────────────────────────────────────────
    function rowTextY(ly: number, h: number, fs: number) {
      return ly + Math.max((h - fs) / 2, 3)
    }

    function leftRow(lbl: string, val: string, ly: number, h = 18, bold = false) {
      doc.rect(ML, ly, leftW, h).stroke('#000')
      const lblW = leftW * 0.30
      doc.rect(ML, ly, lblW, h).fillAndStroke('#F0F0F0', '#000')
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
        .text(lbl, ML + 3, rowTextY(ly, h, 7), { width: lblW - 6, lineBreak: false })
      doc.fontSize(7.5).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000')
        .text(val, ML + lblW + 3, rowTextY(ly, h, 7.5), { width: leftW - lblW - 6, lineBreak: false })
    }

    function leftRowDual(lbl1: string, val1: string, lbl2: string, val2: string, ly: number, h = 18) {
      const half = leftW / 2
      const lblW = half * 0.42
      const lbl2W = half * 0.38
      const rx = ML + half
      const ty7 = rowTextY(ly, h, 7)
      const ty75 = rowTextY(ly, h, 7.5)
      // backgrounds first, then text (evita sobreposição)
      doc.rect(ML, ly, half, h).fillAndStroke('#F8F8F8', '#000')
      doc.rect(ML, ly, lblW, h).fillAndStroke('#F0F0F0', '#000')
      doc.rect(rx, ly, half, h).fillAndStroke('#F8F8F8', '#000')
      doc.rect(rx, ly, lbl2W, h).fillAndStroke('#F0F0F0', '#000')
      // outer border por cima
      doc.rect(ML, ly, leftW, h).stroke('#000')
      // texts
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
        .text(lbl1, ML + 3, ty7, { width: lblW - 4, lineBreak: false })
      doc.fontSize(7.5).font('Helvetica').fillColor('#000')
        .text(val1, ML + lblW + 3, ty75, { width: half - lblW - 6, align: 'center', lineBreak: false })
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
        .text(lbl2, rx + 3, ty7, { width: lbl2W - 4, lineBreak: false })
      doc.fontSize(7.5).font('Helvetica').fillColor('#000')
        .text(val2, rx + lbl2W + 3, ty75, { width: half - lbl2W - 6, align: 'center', lineBreak: false })
    }

    let ly = y
    leftRow('NOME DO SACADO', d.sacadoNome, ly, 18, true)
    ly += 18
    leftRow('ENDEREÇO', `${d.sacadoEndereco}${d.sacadoBairro ? ' - ' + d.sacadoBairro : ''}`, ly, 18)
    ly += 18
    leftRowDual('MUNICÍPIO', d.sacadoCidade, 'ESTADO', d.sacadoEstado, ly, 18)
    ly += 18
    leftRowDual('END. COBRANÇA', d.sacadoEndCobranca ?? 'O MESMO', 'CEP', d.sacadoCep, ly, 22)
    ly += 22
    leftRowDual('CNPJ(MF)', fmtCnpj(d.sacadoCnpj), 'INS. ESTADUAL', d.sacadoIe ?? '', ly, 22)
    ly += 22 + 6

    // Valor por extenso
    doc.rect(ML, ly, leftW, 28).stroke('#000')
    const extLblW = leftW * 0.28
    doc.rect(ML, ly, extLblW, 28).fillAndStroke('#F0F0F0', '#000')
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
      .text('VALOR/EXTENSO', ML + 3, ly + Math.max((28 - 7) / 2, 3), { width: extLblW - 4, lineBreak: false })
    doc.fontSize(7.5).font('Helvetica').fillColor('#000')
      .text(valorPorExtenso(d.totalAmount), ML + extLblW + 3, ly + 4, {
        width: leftW - extLblW - 6, height: 22, lineBreak: true,
      })
    ly += 28 + 6

    // Legal text
    doc.fontSize(7).font('Helvetica').fillColor('#000')
      .text(
        'Reconheço a exatidão desta Duplicata de Venda/Prestação de Serviços, na importância acima\nque pagarei à Peletização Tectil Tapajós LTDA. - ME, ou a sua ordem na praça e vencimentos\nindicados.',
        ML + 3, ly, { width: leftW - 6 }
      )
    ly += 46

    // Signature lines
    doc.fontSize(7).font('Helvetica').fillColor('#000')
      .text('__/__/____', ML + 6, ly)
    doc.moveTo(ML + 50, ly + 12).lineTo(ML + leftW * 0.48, ly + 12).stroke('#000')
    doc.fontSize(6.5).font('Helvetica').fillColor('#555')
      .text('Data do Aceite', ML + 6, ly + 14)

    doc.moveTo(ML + leftW * 0.50, ly + 12).lineTo(ML + leftW - 6, ly + 12).stroke('#000')
    doc.fontSize(6.5).font('Helvetica').fillColor('#555')
      .text('Assinatura do Sacado', ML + leftW * 0.50, ly + 14)
    ly += 30

    // Payment stamp (when paid)
    if (d.pago && d.pagamentoData) {
      ly += 10
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#2d6a2d')
        .text(`Pagamento realizado em ${fmtDate(d.pagamentoData)}`, ML + 3, ly, {
          width: leftW - 6, align: 'center',
        })
    }

    // ── RIGHT side — NFs table ────────────────────────────────────────────────
    const rx = ML + leftW
    let ry = y

    // Header
    const nfHdrH = 16
    doc.rect(rx, ry, rightW, nfHdrH).fillAndStroke('#E8E8E8', '#000')
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
      .text('DUPLICATA REFERENTE Á(S) NFe', rx + 3, ry + 4, { width: rightW - 6, align: 'center', lineBreak: false })
    ry += nfHdrH

    // Column header
    const nfColH = 14
    const nfDateW = rightW * 0.33
    const nfNumW = rightW * 0.28
    const nfValW = rightW - nfDateW - nfNumW

    doc.rect(rx, ry, nfDateW, nfColH).fillAndStroke('#F0F0F0', '#000')
    doc.rect(rx + nfDateW, ry, nfNumW, nfColH).fillAndStroke('#F0F0F0', '#000')
    doc.rect(rx + nfDateW + nfNumW, ry, nfValW, nfColH).fillAndStroke('#F0F0F0', '#000')
    const colHdrTy = ry + Math.max((nfColH / 2) - 3, 2)
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000')
      .text('DATA', rx + 2, colHdrTy, { width: nfDateW - 4, align: 'center', lineBreak: false })
      .text('NFe Nº', rx + nfDateW + 2, colHdrTy, { width: nfNumW - 4, align: 'center', lineBreak: false })
      .text('VALOR', rx + nfDateW + nfNumW + 2, colHdrTy, { width: nfValW - 4, align: 'center', lineBreak: false })
    ry += nfColH

    // NF rows
    const nfRowH = 14
    const totalRows = Math.max(d.nfs.length, Math.floor((bodyH - nfHdrH - nfColH - 26) / nfRowH))
    for (let i = 0; i < totalRows; i++) {
      const nf = d.nfs[i]
      doc.rect(rx, ry, nfDateW, nfRowH).stroke('#000')
      doc.rect(rx + nfDateW, ry, nfNumW, nfRowH).stroke('#000')
      doc.rect(rx + nfDateW + nfNumW, ry, nfValW, nfRowH).stroke('#000')
      if (nf) {
        const rowTy = ry + Math.max((nfRowH / 2) - 3, 2)
        doc.fontSize(7).font('Helvetica').fillColor('#000')
          .text(nf.data, rx + 2, rowTy, { width: nfDateW - 4, align: 'center', lineBreak: false })
          .text(String(nf.numero), rx + nfDateW + 2, rowTy, { width: nfNumW - 4, align: 'center', lineBreak: false })
        doc.fontSize(7).font('Helvetica').fillColor('#000')
          .text(`R$ ${R(nf.valor)}`, rx + nfDateW + nfNumW + 2, rowTy, { width: nfValW - 4, align: 'right', lineBreak: false })
      }
      ry += nfRowH
    }

    // Footer total
    const totFootH = 20
    const totYb = y + bodyH - totFootH
    doc.rect(rx, totYb, rightW, totFootH).fillAndStroke('#E8E8E8', '#000')
    const totTy = totYb + Math.max((totFootH / 2) - 4, 2)
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
      .text('VALOR TOTAL A SER PAGO', rx + 3, totTy, { width: rightW * 0.55, lineBreak: false })
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
      .text(`R$ ${R(d.totalAmount)}`, rx + 3, totTy, { width: rightW - 6, align: 'right', lineBreak: false })

    y += bodyH + 4

    // ── FOOTER BAR ────────────────────────────────────────────────────────────
    const footH = 20
    doc.rect(ML, y, CW, footH).fillAndStroke('#333333', '#000')
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text((d.emitFantasia || d.emitNome).toUpperCase(), ML, y + 5, { width: CW, align: 'center', lineBreak: false })

    doc.end()
  })
}

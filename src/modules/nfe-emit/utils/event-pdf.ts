/**
 * Gerador de PDFs para eventos NF-e:
 *  - Cancelamento (evCancNFe)
 *  - Carta de Correção Eletrônica (evCCe)
 *
 * Usa PDFKit, mesmo padrão do danfe-pdf.ts
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as typeof import('pdfkit')
import * as fs from 'fs'
import * as path from 'path'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: any): string {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('pt-BR')
}

function fmtDateTime(d: any): string {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtCnpj(s?: string | null): string {
  const n = (s ?? '').replace(/\D/g, '')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return s ?? ''
}

function chaveFormatted(c?: string): string {
  if (!c) return 'Não disponível'
  return c.replace(/\D/g, '').match(/.{1,4}/g)?.join(' ') ?? c
}

function getLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'logo.png'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, '../../../..', 'logo.png'),
  ]
  return candidates.find(p => { try { return fs.existsSync(p) } catch { return false } }) ?? null
}

const PW = 595.28
const ML = 40
const MR = 40
const CW = PW - ML - MR
const GREY = '#64748b'
const DARK = '#1e293b'
const RED_BG = '#fee2e2'
const RED = '#dc2626'
const AMBER_BG = '#fef3c7'
const AMBER = '#d97706'
const LINE = '#e2e8f0'

// ─── shared header ────────────────────────────────────────────────────────────

function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  color: string,
  bgColor: string,
  emitNome?: string | null,
  emitCnpj?: string | null,
) {
  const logo = getLogoPath()
  let y = 40

  // Logo
  if (logo) {
    doc.image(logo, ML, y, { height: 40, fit: [120, 40] })
  }

  // Emitente
  if (emitNome) {
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
      .text(emitNome, ML + 130, y + 2, { width: CW - 130 })
    if (emitCnpj) {
      doc.fontSize(9).fillColor(GREY).font('Helvetica')
        .text(`CNPJ: ${fmtCnpj(emitCnpj)}`, ML + 130, y + 16, { width: CW - 130 })
    }
  }

  y += 55

  // Título do evento
  doc.rect(ML, y, CW, 36).fillAndStroke(bgColor, bgColor)
  doc.fontSize(14).fillColor(color).font('Helvetica-Bold')
    .text(title, ML + 10, y + 10, { width: CW - 20 })
  doc.fontSize(9).fillColor(color).font('Helvetica')
    .text(subtitle, ML + 10, y + 24, { width: CW - 20 })
  y += 44

  doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
  return y + 8
}

// ─── shared field row ─────────────────────────────────────────────────────────

function fieldRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  w: number = CW,
) {
  doc.fontSize(7.5).fillColor(GREY).font('Helvetica').text(label, x, y, { width: w })
  doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(value, x, y + 9, { width: w })
  return y + 22
}

// ─── CANCELAMENTO PDF ─────────────────────────────────────────────────────────

export interface CancelPdfData {
  nfeNumber?: number | string | null
  issuedAt?: Date | string | null
  canceledAt?: Date | string
  chNFe?: string
  nProt: string
  xJust: string
  protocol?: string | null
  status?: string | null
  tpAmb?: string
  emitNome?: string | null
  emitCnpj?: string | null
  destNome?: string | null
  destCnpj?: string | null
}

export function buildCancelPdf(data: CancelPdfData): Buffer {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Cancelamento NF-e ${data.nfeNumber ?? ''}` } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    const canceledAt = data.canceledAt ?? new Date()
    const subtitle = `Emitido em ${fmtDateTime(canceledAt)} • ${data.tpAmb === '1' ? 'Produção' : 'Homologação/Simulador'}`
    let y = drawHeader(doc, 'CANCELAMENTO DE NF-e', subtitle, RED, RED_BG, data.emitNome, data.emitCnpj)

    // Dados da NF cancelada
    doc.rect(ML, y, CW, 14).fill('#f8fafc')
    doc.fontSize(8).fillColor(GREY).font('Helvetica-Bold')
      .text('DADOS DA NOTA FISCAL CANCELADA', ML + 8, y + 3)
    y += 18

    const col = CW / 3
    y = fieldRow(doc, ML, y, 'NÚMERO DA NF-e', String(data.nfeNumber ?? '-'), col - 8)
    const y2a = y - 22
    fieldRow(doc, ML + col, y2a, 'DATA DE EMISSÃO', fmtDate(data.issuedAt), col - 8)
    fieldRow(doc, ML + col * 2, y2a, 'DATA DE CANCELAMENTO', fmtDate(canceledAt), col - 8)

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 8

    y = fieldRow(doc, ML, y, 'EMITENTE', data.emitNome ?? '-', CW / 2 - 8)
    const yb = y - 22
    fieldRow(doc, ML + CW / 2, yb, 'CNPJ EMITENTE', fmtCnpj(data.emitCnpj), CW / 2 - 8)

    y = fieldRow(doc, ML, y, 'DESTINATÁRIO', data.destNome ?? '-', CW / 2 - 8)
    const yc = y - 22
    fieldRow(doc, ML + CW / 2, yc, 'CNPJ/CPF DESTINATÁRIO', fmtCnpj(data.destCnpj), CW / 2 - 8)

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 8

    // Chave de acesso
    y = fieldRow(doc, ML, y, 'CHAVE DE ACESSO', chaveFormatted(data.chNFe))
    y = fieldRow(doc, ML, y, 'PROTOCOLO DE AUTORIZAÇÃO ORIGINAL', data.nProt)
    if (data.protocol && data.protocol !== 'SIMULADO') {
      y = fieldRow(doc, ML, y, 'PROTOCOLO DE CANCELAMENTO', data.protocol)
    }

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 8

    // Justificativa
    doc.rect(ML, y, CW, 14).fill('#f8fafc')
    doc.fontSize(8).fillColor(GREY).font('Helvetica-Bold')
      .text('JUSTIFICATIVA DO CANCELAMENTO', ML + 8, y + 3)
    y += 18

    doc.rect(ML, y, CW, 60).fillAndStroke('#fffbeb', '#fde68a')
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
      .text(data.xJust, ML + 10, y + 8, { width: CW - 20, height: 46 })
    y += 70

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 12

    // Status
    const statusLabel = data.status === 'simulated'
      ? 'SIMULADO (modo desenvolvimento — não transmitido ao SEFAZ)'
      : data.protocol ? `REGISTRADO NO SEFAZ — Protocolo: ${data.protocol}` : 'PENDENTE DE ENVIO AO SEFAZ'

    doc.rect(ML, y, CW, 28).fillAndStroke(data.status === 'simulated' ? '#f1f5f9' : '#dcfce7', data.status === 'simulated' ? '#e2e8f0' : '#86efac')
    doc.fontSize(9).fillColor(data.status === 'simulated' ? GREY : '#166534').font('Helvetica-Bold')
      .text(statusLabel, ML + 10, y + 9, { width: CW - 20 })

    doc.end()
  }) as unknown as Buffer
}

// ─── CC-e PDF ─────────────────────────────────────────────────────────────────

export interface CcePdfData {
  nfeNumber?: number | string | null
  issuedAt?: Date | string | null
  cceAt?: Date | string
  chNFe?: string
  nSeqEvento: number
  xCorrecao: string
  protocol?: string | null
  status?: string | null
  tpAmb?: string
  emitNome?: string | null
  emitCnpj?: string | null
  destNome?: string | null
  destCnpj?: string | null
}

const XCOND_USO =
  'A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.'

export function buildCcePdf(data: CcePdfData): Buffer {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `CC-e nº ${data.nSeqEvento} NF-e ${data.nfeNumber ?? ''}` } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    const cceAt = data.cceAt ?? new Date()
    const subtitle = `Carta nº ${data.nSeqEvento} • Emitida em ${fmtDateTime(cceAt)} • ${data.tpAmb === '1' ? 'Produção' : 'Homologação/Simulador'}`
    let y = drawHeader(doc, 'CARTA DE CORREÇÃO ELETRÔNICA — CC-e', subtitle, AMBER, AMBER_BG, data.emitNome, data.emitCnpj)

    // Dados da NF
    doc.rect(ML, y, CW, 14).fill('#f8fafc')
    doc.fontSize(8).fillColor(GREY).font('Helvetica-Bold')
      .text('DADOS DA NOTA FISCAL', ML + 8, y + 3)
    y += 18

    const col = CW / 3
    y = fieldRow(doc, ML, y, 'NÚMERO DA NF-e', String(data.nfeNumber ?? '-'), col - 8)
    const y2a = y - 22
    fieldRow(doc, ML + col, y2a, 'DATA DE EMISSÃO', fmtDate(data.issuedAt), col - 8)
    fieldRow(doc, ML + col * 2, y2a, 'Nº SEQUÊNCIA CC-e', String(data.nSeqEvento), col - 8)

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 8

    y = fieldRow(doc, ML, y, 'EMITENTE', data.emitNome ?? '-', CW / 2 - 8)
    const yb = y - 22
    fieldRow(doc, ML + CW / 2, yb, 'CNPJ EMITENTE', fmtCnpj(data.emitCnpj), CW / 2 - 8)

    y = fieldRow(doc, ML, y, 'DESTINATÁRIO', data.destNome ?? '-', CW / 2 - 8)
    const yc = y - 22
    fieldRow(doc, ML + CW / 2, yc, 'CNPJ/CPF DESTINATÁRIO', fmtCnpj(data.destCnpj), CW / 2 - 8)

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 8

    y = fieldRow(doc, ML, y, 'CHAVE DE ACESSO', chaveFormatted(data.chNFe))

    if (data.protocol && data.protocol !== 'SIMULADO') {
      y = fieldRow(doc, ML, y, 'PROTOCOLO DE REGISTRO', data.protocol)
    }

    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(LINE).stroke()
    y += 8

    // Texto da correção
    doc.rect(ML, y, CW, 14).fill('#f8fafc')
    doc.fontSize(8).fillColor(GREY).font('Helvetica-Bold')
      .text('TEXTO DA CORREÇÃO', ML + 8, y + 3)
    y += 18

    // Caixa da correção — altura variável
    const textH = Math.max(60, Math.ceil(data.xCorrecao.length / 90) * 13 + 16)
    doc.rect(ML, y, CW, textH).fillAndStroke('#fffbeb', '#fde68a')
    doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
      .text(data.xCorrecao, ML + 10, y + 8, { width: CW - 20, height: textH - 16 })
    y += textH + 12

    // Condição de uso
    doc.rect(ML, y, CW, 14).fill('#f8fafc')
    doc.fontSize(8).fillColor(GREY).font('Helvetica-Bold')
      .text('CONDIÇÃO DE USO', ML + 8, y + 3)
    y += 18

    const condH = 52
    doc.rect(ML, y, CW, condH).fillAndStroke('#f8fafc', LINE)
    doc.fontSize(7).fillColor(GREY).font('Helvetica')
      .text(XCOND_USO, ML + 8, y + 6, { width: CW - 16, height: condH - 10 })
    y += condH + 12

    // Status
    const statusLabel = data.status === 'simulated'
      ? 'SIMULADO (modo desenvolvimento — não transmitido ao SEFAZ)'
      : data.protocol ? `REGISTRADO NO SEFAZ — Protocolo: ${data.protocol}` : 'PENDENTE DE ENVIO AO SEFAZ'

    doc.rect(ML, y, CW, 28).fillAndStroke(data.status === 'simulated' ? '#f1f5f9' : '#dcfce7', data.status === 'simulated' ? '#e2e8f0' : '#86efac')
    doc.fontSize(9).fillColor(data.status === 'simulated' ? GREY : '#166534').font('Helvetica-Bold')
      .text(statusLabel, ML + 10, y + 9, { width: CW - 20 })

    doc.end()
  }) as unknown as Buffer
}

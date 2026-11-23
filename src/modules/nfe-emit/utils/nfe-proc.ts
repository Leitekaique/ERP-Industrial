// ─────────────────────────────────────────────────────────────────────────────
// XML de distribuição da NF-e (nfeProc) e dos eventos (procEventoNFe)
//
// A SEFAZ autoriza a <NFe> assinada e devolve um <protNFe> (protocolo). O XML
// que vai para o destinatário e para o contador é o "XML de distribuição":
//
//   <nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
//     <NFe>...</NFe>          ← exatamente como foi assinada e enviada
//     <protNFe>...</protNFe>  ← exatamente como a SEFAZ devolveu
//   </nfeProc>
//
// Eventos (cancelamento, CC-e) seguem o mesmo princípio:
//   <procEventoNFe versao="1.00"> <evento/> <retEvento/> </procEventoNFe>
//
// Os blocos são RECORTADOS do texto original, nunca remontados: a assinatura
// digital cobre o conteúdo byte a byte e qualquer reformatação a invalidaria.
// ─────────────────────────────────────────────────────────────────────────────

export const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe'

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>'

/**
 * Recorta o primeiro elemento <localName>…</localName> do texto, aceitando
 * prefixo de namespace (ex.: <ns1:protNFe>). Quando vier com prefixo, o prefixo
 * é removido para que o elemento herde o namespace padrão do envelope.
 */
export function extractElement(xml: string, localName: string): string | null {
  if (!xml) return null
  const re = new RegExp(`<((?:[\\w.-]+:)?${localName})(?=[\\s>/])[^>]*>[\\s\\S]*?<\\/\\1>`)
  const m = xml.match(re)
  if (!m) return null
  const element = m[0]
  const qname = m[1]
  const colon = qname.indexOf(':')
  if (colon < 0) return element
  return stripPrefix(element, qname.slice(0, colon))
}

/** Recorta todos os elementos <localName> (ex.: vários procEventoNFe numa consulta). */
export function extractAllElements(xml: string, localName: string): string[] {
  if (!xml) return []
  const re = new RegExp(`<((?:[\\w.-]+:)?${localName})(?=[\\s>/])[^>]*>[\\s\\S]*?<\\/\\1>`, 'g')
  const out: string[] = []
  for (const m of xml.matchAll(re)) {
    const qname = m[1]
    const colon = qname.indexOf(':')
    out.push(colon < 0 ? m[0] : stripPrefix(m[0], qname.slice(0, colon)))
  }
  return out
}

function stripPrefix(element: string, prefix: string): string {
  const p = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return element
    .replace(new RegExp(`<(/?)${p}:`, 'g'), '<$1')
    .replace(new RegExp(`\\s+xmlns:${p}="[^"]*"`, 'g'), '')
}

/** Lê o conteúdo de uma tag simples (ex.: <cStat>100</cStat>). */
export function tagValue(xml: string, tag: string): string | null {
  const m = xml?.match(new RegExp(`<(?:[\\w.-]+:)?${tag}>([^<]*)</(?:[\\w.-]+:)?${tag}>`))
  return m ? m[1].trim() : null
}

/** true se o XML já é um XML de distribuição (tem o protocolo da SEFAZ). */
export function isNfeProc(xml: string): boolean {
  return /<(?:[\w.-]+:)?nfeProc[\s>]/.test(xml) && /<(?:[\w.-]+:)?protNFe[\s>]/.test(xml)
}

export function isProcEvento(xml: string): boolean {
  return /<(?:[\w.-]+:)?procEventoNFe[\s>]/.test(xml)
}

/**
 * Monta o nfeProc a partir do XML assinado (pode conter declaração <?xml ?>
 * ou já ser um nfeProc antigo) e do protNFe devolvido pela SEFAZ.
 */
export function buildNfeProc(signedXml: string, protNFeXml: string): string {
  const nfe = extractElement(signedXml, 'NFe')
  if (!nfe) throw new Error('Elemento <NFe> não encontrado no XML assinado')
  const prot = extractElement(protNFeXml, 'protNFe') ?? protNFeXml
  if (!/^<protNFe[\s>]/.test(prot)) throw new Error('Elemento <protNFe> inválido')
  return `${XML_DECL}<nfeProc versao="4.00" xmlns="${NFE_NAMESPACE}">${nfe}${prot}</nfeProc>`
}

/**
 * Monta o procEventoNFe a partir do envEvento assinado (que contém o <evento>)
 * e do <retEvento> devolvido pela SEFAZ.
 */
export function buildProcEventoNFe(signedEnvEventoXml: string, retEventoXml: string): string {
  const evento = extractElement(signedEnvEventoXml, 'evento')
  if (!evento) throw new Error('Elemento <evento> não encontrado no XML assinado')
  const ret = extractElement(retEventoXml, 'retEvento') ?? retEventoXml
  if (!/^<retEvento[\s>]/.test(ret)) throw new Error('Elemento <retEvento> inválido')
  return `${XML_DECL}<procEventoNFe versao="1.00" xmlns="${NFE_NAMESPACE}">${evento}${ret}</procEventoNFe>`
}

/**
 * Confere se o protocolo pertence a esta NF-e: mesma chave e mesmo digest da
 * assinatura (o digVal do protocolo é o DigestValue da NF-e autorizada).
 * Garante que o arquivo salvo é exatamente a NF que a SEFAZ autorizou.
 */
export function protocolMatchesNfe(signedXml: string, protNFeXml: string): { ok: boolean; motivo?: string } {
  const chaveNfe = signedXml.match(/Id="NFe(\d{44})"/)?.[1]
  const chaveProt = tagValue(protNFeXml, 'chNFe')
  if (!chaveNfe || !chaveProt) return { ok: false, motivo: 'Chave de acesso não encontrada' }
  if (chaveNfe !== chaveProt) return { ok: false, motivo: `Chave do protocolo (${chaveProt}) difere da NF (${chaveNfe})` }
  const digNfe = tagValue(signedXml, 'DigestValue')
  const digProt = tagValue(protNFeXml, 'digVal')
  if (digNfe && digProt && digNfe !== digProt) {
    return { ok: false, motivo: 'Assinatura do XML salvo difere da NF autorizada (digVal)' }
  }
  return { ok: true }
}

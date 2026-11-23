/**
 * Constrói XMLs de eventos NF-e 4.0:
 *  - evCancNFe (tpEvento 110111) — Cancelamento
 *  - evCCe     (tpEvento 110110) — Carta de Correção Eletrônica
 *
 * Referência: Manual de Integração NF-e v7.0 (SEFAZ)
 */
import { create } from 'xmlbuilder2'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Formata data no padrão ISO 8601 com offset BRT (-03:00), sem milissegundos.
 *  O schema TDateTimeUTC do SEFAZ exige HH:MM:SS±HH:MM — milissegundos causam cStat=225.
 *  Usa America/Sao_Paulo via Intl.DateTimeFormat para evitar offset manual. */
function dhEvento(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  // sv-SE produz "YYYY-MM-DD HH:MM:SS" — substituímos o espaço por T e adicionamos o offset
  const local = fmt.format(d).replace(' ', 'T')
  return `${local}-03:00`
}

/** Id do infEvento: "ID" + tpEvento(6) + chave(44) + nSeqEvento(02) */
function buildInfEventoId(tpEvento: string, chave44: string, nSeq: number): string {
  return `ID${tpEvento}${chave44}${String(nSeq).padStart(2, '0')}`
}

// ─── Cancelamento ─────────────────────────────────────────────────────────────

export interface CancelEventParams {
  cnpjEmitente: string       // CNPJ do emitente sem formatação
  chNFe: string              // chave de acesso 44 dígitos
  nProt: string              // protocolo de autorização da NF-e
  xJust: string              // justificativa (15–255 caracteres)
  tpAmb?: '1' | '2'         // 1=prod, 2=homolog (default: 2)
  nSeqEvento?: number        // sequência (default: 1)
  cOrgao?: string            // código UF SEFAZ (default: SEFAZ_UF env ou '35' = SP)
}

export function buildCancelEventXml(params: CancelEventParams): string {
  const {
    cnpjEmitente,
    chNFe,
    nProt,
    xJust,
    tpAmb = '2',
    nSeqEvento = 1,
    cOrgao = process.env.SEFAZ_UF ?? '35',
  } = params

  const tpEvento = '110111'
  const infId = buildInfEventoId(tpEvento, chNFe, nSeqEvento)
  const dh = dhEvento()

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('envEvento', {
      versao: '1.00',
      xmlns: 'http://www.portalfiscal.inf.br/nfe',
    })
      .ele('idLote').txt('1').up()
      .ele('evento', { versao: '1.00' })
        .ele('infEvento', { Id: infId })
          .ele('cOrgao').txt(cOrgao).up()
          .ele('tpAmb').txt(tpAmb).up()
          .ele('CNPJ').txt(cnpjEmitente.replace(/\D/g, '')).up()
          .ele('chNFe').txt(chNFe).up()
          .ele('dhEvento').txt(dh).up()
          .ele('tpEvento').txt(tpEvento).up()
          .ele('nSeqEvento').txt(String(nSeqEvento)).up()
          .ele('verEvento').txt('1.00').up()
          .ele('detEvento', { versao: '1.00' })
            .ele('descEvento').txt('Cancelamento').up()
            .ele('nProt').txt(nProt).up()
            .ele('xJust').txt(xJust).up()
          .up() // detEvento
        .up() // infEvento
      .up() // evento
    .up() // envEvento

  return doc.end({ prettyPrint: false })
}

// ─── CC-e ─────────────────────────────────────────────────────────────────────

// Texto fixo exigido pelo schema leiauteCCe_v1.00.xsd (enumeração exata) — NT 2013.005
const XCOND_USO =
  'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.'

export interface CceEventParams {
  cnpjEmitente: string       // CNPJ do emitente sem formatação
  chNFe: string              // chave de acesso 44 dígitos
  xCorrecao: string          // texto da correção (15–1000 caracteres)
  tpAmb?: '1' | '2'
  nSeqEvento?: number        // 1..20
  cOrgao?: string            // código UF SEFAZ (default: SEFAZ_UF env ou '35' = SP)
}

export function buildCceEventXml(params: CceEventParams): string {
  const {
    cnpjEmitente,
    chNFe,
    xCorrecao,
    tpAmb = '2',
    nSeqEvento = 1,
    cOrgao = process.env.SEFAZ_UF ?? '35',
  } = params

  const tpEvento = '110110'
  const infId = buildInfEventoId(tpEvento, chNFe, nSeqEvento)
  const dh = dhEvento()

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('envEvento', {
      versao: '1.00',
      xmlns: 'http://www.portalfiscal.inf.br/nfe',
    })
      .ele('idLote').txt('1').up()
      .ele('evento', { versao: '1.00' })
        .ele('infEvento', { Id: infId })
          .ele('cOrgao').txt(cOrgao).up()
          .ele('tpAmb').txt(tpAmb).up()
          .ele('CNPJ').txt(cnpjEmitente.replace(/\D/g, '')).up()
          .ele('chNFe').txt(chNFe).up()
          .ele('dhEvento').txt(dh).up()
          .ele('tpEvento').txt(tpEvento).up()
          .ele('nSeqEvento').txt(String(nSeqEvento)).up()
          .ele('verEvento').txt('1.00').up()
          .ele('detEvento', { versao: '1.00' })
            .ele('descEvento').txt('Carta de Correcao').up()  // texto fixo SEFAZ — sem acento
            .ele('xCorrecao').txt(xCorrecao).up()
            .ele('xCondUso').txt(XCOND_USO).up()
          .up() // detEvento
        .up() // infEvento
      .up() // evento
    .up() // envEvento

  return doc.end({ prettyPrint: false })
}

// ─── Assinatura de evento ─────────────────────────────────────────────────────
//
// A assinatura de evento segue o mesmo padrão da NF-e (XML-DSIG RSA-SHA1),
// mas referencia o elemento `infEvento` (pelo seu @Id) em vez de `infNFe`.
// A função signEventXml usa o mesmo xml-signer, apenas com xpath diferente.

import { getSefazEnv } from './xml-signer'
import * as forge from 'node-forge'
import { SignedXml } from 'xml-crypto'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Assina o XML do evento usando o certificado armazenado na empresa (certA1Keystore).
 * Aceita certBuffer/certPassword diretamente para evitar leitura duplicada do BD.
 * Mesmo padrão de assinatura e injeção de KeyInfo do signXml (xml-signer.ts).
 */
export function signEventXml(xml: string, certBuffer?: Buffer, certPassword?: string): string {
  const mode = getSefazEnv()

  if (mode === 'simulator') {
    return xml.replace(
      '</infEvento>',
      '</infEvento><!-- Assinatura simulada — ative SEFAZ_ENV=homologacao para assinatura real -->',
    )
  }

  // Fallback para arquivo local quando certBuffer não é fornecido (compatibilidade)
  let buf = certBuffer
  let pwd = certPassword ?? ''
  if (!buf) {
    const certPath = path.resolve('certs/tapajos-cert.pfx')
    if (!fs.existsSync(certPath)) throw new Error('Certificado digital não encontrado.')
    buf = fs.readFileSync(certPath)
    pwd = process.env.CERT_PASSWORD ?? ''
  }

  try {
    const pfxDer = buf.toString('binary')
    const p12Asn1 = forge.asn1.fromDer(pfxDer, false)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pwd)

    const keyBags =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ] ?? []
    const certBags =
      p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []

    if (!keyBags.length || !certBags.length) {
      throw new Error('Chave privada ou certificado não encontrados no .pfx')
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyBags[0].key!)
    const certAsn1 = forge.pki.certificateToAsn1(certBags[0].cert!)
    const certDer = forge.asn1.toDer(certAsn1).getBytes()
    const certBase64 = forge.util.encode64(certDer)

    // Mesmo padrão do signXml: suprime KeyInfo automático, injeta manualmente após assinar
    const sig = new SignedXml({ privateKey: privateKeyPem } as any)
    ;(sig as any).getKeyInfo = () => ''

    sig.addReference({
      xpath: "//*[local-name()='infEvento']",
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    sig.computeSignature(xml, {
      location: { reference: "//*[local-name()='infEvento']", action: 'after' },
      prefix: '',
    })

    // Injeta KeyInfo com namespace explícito (obrigatório pelo SEFAZ)
    const keyInfoBlock = `<KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>`
    const signedXml = sig.getSignedXml()
    if (signedXml.includes('<KeyInfo')) {
      return signedXml.replace(/<KeyInfo[\s\S]*?<\/KeyInfo>/, keyInfoBlock)
    }
    return signedXml.replace('</SignatureValue>', `</SignatureValue>${keyInfoBlock}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Falha ao assinar evento XML: ${msg}`)
  }
}

/**
 * Constrói XMLs de eventos NF-e 4.0:
 *  - evCancNFe (tpEvento 110111) — Cancelamento
 *  - evCCe     (tpEvento 110110) — Carta de Correção Eletrônica
 *
 * Referência: Manual de Integração NF-e v7.0 (SEFAZ)
 */
import { create } from 'xmlbuilder2'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Formata data no padrão ISO 8601 com offset BRT (-03:00) */
function dhEvento(d: Date = new Date()): string {
  // Offset fixo BRT (-03:00) — SEFAZ SP exige offset explícito
  const offset = -180 // BRT = UTC-3
  const local = new Date(d.getTime() + offset * 60 * 1000)
  return local.toISOString().replace('Z', '-03:00')
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
}

export function buildCancelEventXml(params: CancelEventParams): string {
  const {
    cnpjEmitente,
    chNFe,
    nProt,
    xJust,
    tpAmb = '2',
    nSeqEvento = 1,
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
          .ele('cOrgao').txt('91').up()        // 91 = SVAN (ambiente nacional)
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

const XCOND_USO =
  'A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.'

export interface CceEventParams {
  cnpjEmitente: string       // CNPJ do emitente sem formatação
  chNFe: string              // chave de acesso 44 dígitos
  xCorrecao: string          // texto da correção (15–1000 caracteres)
  tpAmb?: '1' | '2'
  nSeqEvento?: number        // 1..20
}

export function buildCceEventXml(params: CceEventParams): string {
  const {
    cnpjEmitente,
    chNFe,
    xCorrecao,
    tpAmb = '2',
    nSeqEvento = 1,
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
          .ele('cOrgao').txt('91').up()
          .ele('tpAmb').txt(tpAmb).up()
          .ele('CNPJ').txt(cnpjEmitente.replace(/\D/g, '')).up()
          .ele('chNFe').txt(chNFe).up()
          .ele('dhEvento').txt(dh).up()
          .ele('tpEvento').txt(tpEvento).up()
          .ele('nSeqEvento').txt(String(nSeqEvento)).up()
          .ele('verEvento').txt('1.01').up()
          .ele('detEvento', { versao: '1.01' })
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

export function signEventXml(xml: string): string {
  const mode = getSefazEnv()

  if (mode === 'simulator') {
    return xml.replace(
      '</infEvento>',
      '</infEvento><!-- Assinatura simulada — ative SEFAZ_ENV=homologacao para assinatura real -->',
    )
  }

  const certPath = process.env.CERT_PATH
  const certPassword = process.env.CERT_PASSWORD ?? ''

  if (!certPath || !fs.existsSync(certPath)) {
    throw new Error('Certificado digital não configurado (CERT_PATH).')
  }

  const certBuffer = fs.readFileSync(certPath)

  try {
    const pfxDer = certBuffer.toString('binary')
    const p12Asn1 = forge.asn1.fromDer(pfxDer, false)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPassword)

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

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any)

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
      location: {
        reference: "//*[local-name()='infEvento']",
        action: 'after',
      },
      prefix: '',
    })

    return sig.getSignedXml()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Falha ao assinar evento XML: ${msg}`)
  }
}

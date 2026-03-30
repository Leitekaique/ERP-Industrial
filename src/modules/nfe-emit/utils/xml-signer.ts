import * as forge from 'node-forge'
import { SignedXml } from 'xml-crypto'

// ─── Modo de operação ──────────────────────────────────────────────────────────
// SEFAZ_ENV=simulator  → adiciona comentário, sem cert necessário (DEV)
// SEFAZ_ENV=homologacao ou producao → assinatura RSA-SHA1 real com XML-DSIG

export function getSefazEnv(): 'simulator' | 'homologacao' | 'producao' {
  const env = process.env.SEFAZ_ENV ?? 'simulator'
  if (env === 'homologacao' || env === 'producao') return env
  return 'simulator'
}

// ─── Assinatura XML-DSIG ───────────────────────────────────────────────────────
//
// O SEFAZ exige XML-DSIG com:
//   - Elemento assinado: infNFe (referenciado pelo Id="NFe{chave}")
//   - Canonicalização: C14N (http://www.w3.org/TR/2001/REC-xml-c14n-20010315)
//   - Digest: SHA-1 sobre o infNFe canonicalizado
//   - Assinatura: RSA-SHA1 sobre o SignedInfo canonicalizado
//   - KeyInfo: X509Certificate (DER em base64)
//
// A biblioteca xml-crypto implementa tudo isso corretamente.
// O node-forge extrai a chave privada e o certificado do arquivo .pfx (PKCS#12).

export function signXml(xml: string, certBuffer: Buffer, password: string): string {
  const mode = getSefazEnv()

  // ── Modo Simulador: nenhum certificado necessário ─────────────────────────
  if (mode === 'simulator') {
    console.log('📋 NF-e assinada em modo SIMULADOR (SEFAZ_ENV=simulator)')
    // Insere um comentário de assinatura simulada para manter estrutura compatível
    return xml.replace('</infNFe>', '</infNFe><!-- Assinatura simulada — ative SEFAZ_ENV=homologacao para assinatura real -->')
  }

  // ── Modo Real: assinatura RSA-SHA1 com XML-DSIG ───────────────────────────
  try {
    // 1. Parseia o PKCS#12 com node-forge para extrair chave e certificado
    const pfxDer = certBuffer.toString('binary')
    const p12Asn1 = forge.asn1.fromDer(pfxDer, false)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password)

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []

    if (!keyBags.length || !certBags.length) {
      throw new Error('Chave privada ou certificado não encontrados no arquivo .pfx')
    }

    const privateKey = keyBags[0].key!
    const certificate = certBags[0].cert!

    // 2. Converte para PEM (formato que xml-crypto aceita)
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey)

    // 3. Extrai o certificado como DER em base64 (para o KeyInfo/X509Certificate)
    const certAsn1 = forge.pki.certificateToAsn1(certificate)
    const certDer = forge.asn1.toDer(certAsn1).getBytes()
    const certBase64 = forge.util.encode64(certDer)

    // 4. Configura o SignedXml com RSA-SHA1
    const sig = new SignedXml({
      privateKey: privateKeyPem,
      // KeyInfo personalizado: inclui o X509Certificate do certificado A1
      publicCert: `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any)

    // Referência ao elemento infNFe com as transforms exigidas pelo SEFAZ:
    //   - enveloped-signature: remove o próprio elemento Signature do digest
    //   - C14N: canonicalização XML
    sig.addReference({
      xpath: "//*[local-name()='infNFe']",
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    // 5. Computa a assinatura — insere <Signature> logo após </infNFe> dentro de <NFe>
    sig.computeSignature(xml, {
      location: {
        reference: "//*[local-name()='infNFe']",
        action: 'after',
      },
      prefix: '', // sem prefixo: <Signature xmlns="..."> em vez de <ds:Signature>
    })

    console.log(`✅ NF-e assinada digitalmente (${mode})`)
    return sig.getSignedXml()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Falha ao assinar XML: ${msg}`)
  }
}

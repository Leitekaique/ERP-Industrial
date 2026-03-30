# AUDITORIA FISCAL — Módulo NF-e | Peletização Têxtil Tapajós LTDA ME
**Data da auditoria:** 28/03/2026
**Auditor:** ERP Tapajós Internal Audit (Claude Code)
**Versão do sistema analisada:** TapajosERP-1.0 (xml-builder.ts + nfe-emit.service.ts + danfe-pdf.ts)
**Regime tributário:** Simples Nacional — CRT=1
**Atividade:** Beneficiamento têxtil / peletização (industrialização por encomenda)

---

## 1. SUMÁRIO EXECUTIVO

O módulo de emissão de NF-e do ERP Tapajós está **estruturalmente correto** para o layout 4.00 e apresenta conformidade adequada para operações simples de saída. Foram identificados **5 problemas críticos** que devem ser corrigidos antes do go-live em produção: (1) o `cNF` (código numérico da chave) é gerado aleatoriamente a cada chamada, sem persistência, causando risco de chaves inconsistentes entre XML assinado e banco; (2) o CFOP 5902 está listado em `NON_BILLING_CFOPS` mas não possui lógica para gerar o item de **cobrança de mão de obra separado**, configurando risco de sub-faturamento; (3) a `infAdic` do XML (xml-builder.ts) inclui apenas parte das declarações obrigatórias do Simples Nacional, faltando o texto gerado pelo `buildInfoAdic` que fica no service e não é concatenado corretamente com os disclaimers fixos; (4) o `rejectUnauthorized: false` no agente HTTPS **desabilita a validação do certificado SEFAZ**, o que é inseguro em produção; (5) não há referência à NF de entrada do material (`NFref`) nos XMLs de retorno 5902, elemento recomendado para evitar questionamentos fiscais. Foram identificados ainda **4 alertas** de conformidade que merecem atenção antes do deploy.

---

## 2. BLOCO 1 — REGRAS FISCAIS POR CFOP

### 2.1 CFOP 5902 — Retorno de mercadoria recebida para industrialização por encomenda

#### Natureza de operação
✅ **Correto.** A natureza padrão no service é `nfe.naturezaOperacao ?? 'Prestação de serviço de beneficiamento'`. Para CFOP 5902, o texto correto nos termos do AJUSTE SINIEF 07/2005 seria **"Retorno de mercadoria recebida para industrialização por encomenda"**, mas o campo é editável pelo usuário. O sistema permite customização, o que é adequado.

#### ICMS — CSOSN

✅ **Correto.** CSOSN padrão é `400` (`xml-builder.ts` linha 238: `const csosn = item.impostos?.icms?.csosn || '400'`).

Para Simples Nacional executando **retorno de industrialização** (CFOP 5902), a operação não é tributada pelo ICMS regular (o ICMS está englobado no Simples). O CSOSN correto é:

- **CSOSN 400** — "Não tributada pelo Simples Nacional" — **correto** quando a empresa não opta por destacar crédito.
- **CSOSN 900** — poderia ser usado se houver cálculo de crédito outorgado com destaque, mas **não é obrigatório** para este CFOP.

⚠️ **Alerta:** O campo `icmsSnRate` vem do banco (`Company.icmsSnRate`) e pode estar nulo se não cadastrado. Nesse caso `pCredSN = 0` e `vCredICMSSN = 0`, o que resulta em CSOSN 400 sem crédito. Isso está **correto fiscalmente** mas o cadastro da empresa deve ter a taxa preenchida (recomendado: 1,25%) para que o crédito seja destacado conforme art. 23 da LC 123/2006.

**Fundamento:** LC 123/2006 art. 13, §2º; Resolução CGSN 140/2018 art. 59.

#### IPI — CST

✅ **Correto.** O código padrão é CST `53` (`xml-builder.ts` linha 258: `ipi.ele('IPINT').ele('CST').txt(item.impostos?.ipi?.cst || '53')`).

**CST 53 = "Saída não tributada"** — é o código correto para Simples Nacional. Empresas do SN não são contribuintes do IPI para fins de apuração e recolhimento, mas devem preencher o campo com CST 53 ou 99 (depende do NCM). Para beneficiamento têxtil sem industrialização de produto IPI-tributável, o CST 53 está **correto**.

O enquadramento `cEnq = '999'` (linha 257) é o código para "Não se aplica", correto para quem não é contribuinte do IPI.

**Fundamento:** RIPI/2010 (Decreto 7.212/2010) art. 5º, I; NT NF-e 2011/004.

#### PIS/COFINS — CST

✅ **Correto.** O padrão é CST `08` para PIS e COFINS (`xml-builder.ts` linhas 261–264).

**CST 08 = "Operação sem incidência da contribuição"** — é o código correto para empresas do Simples Nacional, pois o PIS/COFINS está incluído no DAS e não há apuração separada.

**Fundamento:** IN RFB 1.911/2019 art. 107; Lei 9.718/1998 art. 8º, §1º c/c LC 123/2006 art. 13, §3º.

#### CEST — obrigatoriedade

✅ **Não obrigatório** para serviços de industrialização por encomenda (CFOP 5902) sobre tecido/malha de terceiros.

O CEST é exigido apenas para operações sujeitas à **Substituição Tributária** do ICMS, conforme Convênio ICMS 142/2018. Serviços de beneficiamento (peletização de tecido de terceiros) **não estão sujeitos à ST** e, portanto, o CEST não é obrigatório.

O código está implementado como opcional: `if (item.cest) prod.ele('CEST').txt(item.cest)` (linha 221). **Correto.**

#### Crédito ICMS art. 23 LC 123/2006

✅ **Correto** — com ressalvas de cadastro.

A alíquota de 1,25% é aplicável para empresas na faixa de receita bruta de até R$ 180.000,00/ano (Anexo II da LC 123/2006 — indústria). Para atividade de beneficiamento, dependendo da tabela vigente, a alíquota pode variar. **Recomenda-se verificar o Anexo II vigente (LC 123/2006 com atualizações da LC 155/2016)** para confirmar a faixa correta.

⚠️ **Alerta:** A alíquota de 1,25% está **hardcoded** via `Company.icmsSnRate` no banco. Se a empresa mudar de faixa de receita, o valor não é atualizado automaticamente. O sistema não tem validação de faixa de receita.

O texto gerado em `buildInfoAdic` (`nfe-emit.service.ts` linha 1753) está correto:
```
"PERMITE O APROVEITAMENTO DO CREDITO DE ICMS NO VALOR DE R$ X,XX
CORRESPONDENTE A ALIQUOTA DE 1,25% NOS TERMOS DO ART. 23 DA LEI COMPLEMENTAR 123/2006"
```

**Fundamento:** LC 123/2006 art. 23; Resolução CGSN 140/2018 art. 58.

#### Declaração "não gera crédito de ISS e IPI" — CFOP 5902

❌ **PROBLEMA — Declaração incorreta para CFOP 5902.**

O texto fixo em `xml-builder.ts` linha 351–352:
```typescript
disclaimers.push('I. DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL')
disclaimers.push('II. NAO GERA DIREITO A CREDITO FISCAL DE ISS E IPI')
```

Para CFOP **5902** (retorno de industrialização), a operação **não envolve prestação de serviço de ISS** — o ISS eventualmente incide sobre serviços municipais, mas não sobre industrialização por encomenda interestadual ou intraestadual na NF-e. A declaração "não gera crédito de ISS" está tecnicamente **inadequada** para este CFOP porque ISS é tributo municipal e não é creditável em NF-e de qualquer forma — a declaração correta deve focar no ICMS e IPI.

**Texto correto conforme modelo histórico da empresa:**
```
I. DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL;
II. NAO GERA DIREITO A CREDITO FISCAL DE IPI;
III. PERMITE O APROVEITAMENTO DO CREDITO DE ICMS NO VALOR DE R$ X,XX
     CORRESPONDENTE A ALIQUOTA DE 1,25%; NOS TERMOS DO ART. 23 DA LC 123/2006
```

**Impacto:** Declaração incorreta pode gerar glosa de crédito pelo destinatário ou questionamento em auditoria fiscal.

**Correção recomendada** (`xml-builder.ts`, linhas 349–353):
```typescript
if (crt === '1') {
  disclaimers.push('I. DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL')
  disclaimers.push('II. NAO GERA DIREITO A CREDITO FISCAL DE IPI')
  // Nota: o crédito de ICMS é inserido pelo buildInfoAdic no service
}
```

**Fundamento:** LC 123/2006 art. 23; Resolução CGSN 140/2018 art. 58.

---

### 2.2 CFOP 5124 — Industrialização efetuada para terceiros (insumos aplicados)

#### Natureza de operação
✅ Texto recomendado: **"Industrialização efetuada para terceiros"** — configurável pelo usuário no campo `naturezaOperacao`.

#### ICMS — CSOSN
✅ **CSOSN 400** (padrão) é correto para insumos aplicados em industrialização por encomenda no Simples Nacional — não há destaque de ICMS separado.

⚠️ **Alerta:** Se o destinatário for contribuinte do ICMS em outro estado, pode ser necessário recolher DIFAL (EC 87/2015). O sistema não implementa cálculo de DIFAL. Para operações interestaduais B2B, verificar se a alíquota interestadual e o DIFAL se aplicam.

#### IPI — obrigatoriedade
⚠️ **Alerta:** Para CFOP 5124, o IPI **pode ser obrigatório** se os insumos forem produtos industrializados sujeitos ao IPI (ex.: fios sintéticos NCM 5402). Neste caso, o CST de IPI deve ser verificado item a item conforme a TIPI.

Para materiais reciclados / peletizados **não sujeitos ao IPI**, o CST 53 está correto.

**Fundamento:** RIPI/2010 art. 9º, I; NT NF-e tabela de CSTs de IPI.

#### PIS/COFINS — CST
✅ CST 08 correto (mesma razão do 5902).

#### CEST — 5124
✅ Não obrigatório pelo mesmo motivo do 5902 (operação de industrialização, sem ST).

#### Crédito ICMS art. 23 — 5124
✅ Aplica-se da mesma forma que 5902 se o CSOSN for 900/101/201.

---

### 2.3 CFOP 5101 — Venda de produto (malha)

#### Diferenças em relação ao 5124
Para venda de produto próprio (malha de fibra reciclada produzida pela Tapajós):

- **ICMS:** CSOSN 400 (sem crédito) ou **CSOSN 101** (com crédito ao comprador, se habilitado). A empresa deve verificar se a venda de produto próprio gera crédito ao adquirente.
- **IPI:** Verificar se a malha é produto industrializado tributado. Se sim, deve haver destaque de IPI com alíquota da TIPI. Para malha de fibra reciclada (provavelmente NCM 6006 ou similar), verificar TIPI posição 60.

#### CEST — 5101 e NCM de malha
⚠️ **Alerta:** Para venda de malha, **o CEST pode ser obrigatório** se o produto estiver incluído em lista de ST estadual. No estado de SP, o Anexo XV do RICMS/SP lista produtos têxteis com ST. Para malha de fibra reciclada, verificar:

- NCM provável: 6006.31.00 (malha circular de fibras sintéticas) ou 5512/5513/5515
- Segmento CEST: verificar tabela do Convênio ICMS 142/2018

**Se o produto estiver na lista, o CEST é OBRIGATÓRIO e a ausência invalida a NF-e.**

**Fundamento:** Convênio ICMS 142/2018; RICMS-SP (Decreto 45.490/2000) Anexo XV.

---

## 3. BLOCO 2 — CAMPOS OBRIGATÓRIOS NO XML

### 3.1 Campo `<indIntermed>` (linha 164 do xml-builder.ts)

✅ **Implementado e correto.** O campo está sendo gerado:
```typescript
ide.ele('indIntermed').txt(dto.indIntermed ?? '0')
```

Obrigatório a partir do **layout NF-e 4.00** (NT 2020.007). Valor `0` = operação sem intermediador (correto para operações B2B diretas como beneficiamento têxtil). Valor `1` seria para vendas via marketplace.

Para a atividade da Tapajós (beneficiamento para clientes diretos), `indIntermed = 0` está **correto**.

---

### 3.2 Campo `<CEST>`

✅ **Implementado como opcional** (`if (item.cest) prod.ele('CEST').txt(item.cest)`, linha 221).

Conforme análise do Bloco 1: não obrigatório para 5902 e 5124. Para 5101 (venda de malha), verificar necessidade conforme NCM e tabela ST-SP.

---

### 3.3 Seção `<cobr>` — fatura e duplicatas

✅ **Implementada corretamente** (`xml-builder.ts` linhas 316–332).

A seção é gerada apenas quando `dto.cobr` está presente e tem dados (`if (dto.cobr && (dto.cobr.fatura || dto.cobr.duplicatas?.length))`). Ela é construída no service quando `billingTerms` e `billingAmt > 0` (`nfe-emit.service.ts` linhas 1660–1671).

⚠️ **Alerta — CFOP 5902 excluído do billingAmt:** O `NON_BILLING_CFOPS` inclui `5902` (office.config.ts linha 20), portanto quando a NF tem apenas itens 5902 (retorno do material + MO embutido), o `billingAmt = null` e **a seção `<cobr>` não é gerada**, mesmo que haja cobrança. Isso ocorre porque o system trata o 5902 como "retorno não cobrado".

**Impacto:** Se o valor de mão de obra estiver embutido no item 5902, a cobrança não gerará duplicata, o que pode causar problema no contas a receber.

**Recomendação:** Revisar a lógica de `NON_BILLING_CFOPS` — se o 5902 contém MO embutida, deveria ser considerado billable. Alternativamente, usar itens separados: 5902 para o material (não cobrado) e 5124 para os insumos (cobrado).

---

### 3.4 Campo `<dhSaiEnt>`

✅ **Implementado** (`xml-builder.ts` linha 136–137):
```typescript
const dhSaiEnt = dhEmi  // Data de saída = mesma data de emissão
```

Para operações de industrialização por encomenda (retorno do produto beneficiado), a data/hora de saída igual à emissão é aceita pelo SEFAZ. O MOC NF-e 7.0 permite que `dhSaiEnt` seja igual a `dhEmi` quando o produto sai no ato da emissão.

✅ O formato ISO 8601 com timezone `-03:00` está correto.

---

### 3.5 `<infIntermed>` vs `<indIntermed>`

✅ `<indIntermed>` está implementado corretamente na tag `<ide>`.

`<infIntermed>` é um **bloco diferente**, obrigatório apenas quando `indIntermed = 1` (operação com intermediador/marketplace). Para a Tapajós, com `indIntermed = 0`, **`<infIntermed>` não deve ser incluído** — e de fato não está. Correto.

**Fundamento:** NT NF-e 2020.007 (layout 4.00 versão D).

---

### 3.6 Referência à NF de entrada — `<NFref>` para CFOP 5902

✅ **Implementado em 29/03/2026.**

O xml-builder gera múltiplos `<NFref>` a partir do campo `refNFe` da NF, que aceita chaves separadas por vírgula/nova linha. O formato suporta `chave|P` para devolução parcial. O campo é editável na tela de emissão do draft (campo "Chave(s) da NF do cliente referenciada"). As informações complementares (infCpl) incluem automaticamente os textos "DEV. TOTAL DA SUA NF-E..." ou "DEV. PARCIAL..." para cada chave informada.

**Fundamento:** MOC NF-e 7.0 item 4.3.1.8; AJUSTE SINIEF 01/2015; RICMS-SP art. 402.

---

### 3.7 Campo `<vFrete>` por item vs total

✅ **Implementado corretamente.** O frete por item (`item.frete`) é inserido em `<det><prod><vFrete>` apenas quando presente (linha 232: `if (item.frete) prod.ele('vFrete').txt(...)`). O frete total é somado em `<ICMSTot><vFrete>` (linha 283).

⚠️ **Alerta:** No `buildEmitDtoFromDraft` (linha 1631), o frete por item está **sempre zerado** (`frete: 0`). O frete total é passado via `freteValor` no DTO de emissão e aplicado apenas no total da NF. Isso significa que `<vFrete>` nos itens nunca é preenchido — apenas o total. Isso é **fiscalmente aceitável** mas pode causar divergência se a SEFAZ cruzar item a item.

---

## 4. BLOCO 3 — DANFE

### 4.1 Código de barras CODE-128 acima da chave

❌ **AUSENTE — Obrigatório pelo MOC NF-e 7.0.**

O DANFE gerado em `danfe-pdf.ts` **não inclui código de barras CODE-128** da chave de acesso. O campo `chaveFormatted(d.chaveAcesso)` (linha 409) exibe apenas o texto formatado da chave, sem o barcode.

O **MOC NF-e versão 7.0** (publicado pela ENCAT/SEFAZ), item 7.3.1, exige:
> "A chave de acesso deverá ser representada por código de barras do tipo CODE-128C, com altura mínima de 13 mm e largura mínima que possibilite a leitura."

**Impacto:** DANFE não conformante com o MOC. Pode ser recusado em fiscalizações ou por destinatários que validam o barcode.

**Correção recomendada:** Usar a biblioteca `bwip-js` (já disponível em projetos Node.js) para gerar o CODE-128 da chave de acesso:
```typescript
import bwipjs from 'bwip-js'
const barcodeBuffer = await bwipjs.toBuffer({
  bcid: 'code128',
  text: d.chaveAcesso?.replace(/\s/g, '') ?? '',
  scale: 2,
  height: 13,
  includetext: false,
})
doc.image(barcodeBuffer, chaveX + 3, y + fiscoH + 22, { width: chaveW - 6, height: 13 })
```

**Fundamento:** MOC NF-e 7.0 item 7.3.1; NT NF-e 2013/005.

---

### 4.2 Seções obrigatórias do DANFE

Verificação contra MOC NF-e 7.0, item 7.3:

| Seção | Status | Observação |
|---|---|---|
| Canhoto (recibo de entrega) | ✅ | Linhas 282–319 |
| Identificação do emitente | ✅ | Linhas 344–413 |
| "DANFE" + nº + série + folha | ✅ | Linhas 372–392 |
| Natureza da operação + Protocolo | ✅ | Linhas 416–424 |
| IE emitente + CNPJ | ✅ | Linhas 426–433 |
| Destinatário/Remetente | ✅ | Linhas 435–471 |
| Fatura + Duplicatas | ✅ (opcional) | Linhas 474–517 |
| Cálculo do Imposto | ✅ | Linhas 521–548 |
| Transportador / Volumes | ✅ | Linhas 550–598 |
| Dados dos Produtos/Serviços | ✅ | Linhas 600+ |
| Dados Adicionais (infAdic) | ✅ | Função drawDadosAdicionais |
| Código de Barras CODE-128 | ❌ | **AUSENTE** — ver item 4.1 |
| Chave de acesso (texto) | ✅ | Linha 409 |
| "Consulta em www.nfe.fazenda.gov.br" | ✅ | Linhas 411–412 |
| Indicador 0-ENTRADA/1-SAÍDA | ✅ | Linhas 381–387 |

**Única seção faltante crítica:** código de barras CODE-128.

---

### 4.3 Cálculo do Imposto — campos para Simples Nacional

✅ **Correto** para Simples Nacional.

No DANFE (`danfe-pdf.ts` linhas 529–548):
- **Base de Cálculo do ICMS = 0,00** — correto (hardcoded na linha 529), pois SN não destaca BC do ICMS na forma regular.
- **Valor do ICMS = 0,00** — correto (linha 530).
- **Base ICMS Subst. e Valor ICMS Subst. = 0,00** — correto (linhas 531–532).
- **V. Aprox. Tributos** — preenchido com `valorAproxTributos` (linha 534–537), correto conforme Lei 12.741/2012.
- **Valor Total dos Produtos** — preenchido (linha 538).
- **Valor do IPI = 0** — correto para SN.
- **Valor Total da NF** — preenchido (linha 547).

---

## 5. BLOCO 4 — CONEXÃO SEFAZ

### 5.1 Fluxo técnico de autorização

O fluxo completo (nfe-emit.service.ts linhas 1773–1846):

1. **Modo:** determinado por `getSefazEnv()` via `SEFAZ_ENV` env var (`simulator` | `homologacao` | `producao`).
2. **WebService:** `NFeAutorizacao4` — serviço SOAP 1.2 para autorização síncrona.
3. **Endpoints:**
   - Homologação: `https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx`
   - Produção: `https://nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx`
4. **Schema SOAP:** SOAP 1.2 com header `nfeCabecMsg` (cUF + versaoDados) e body `nfeDadosMsg/enviNFe` (lote síncrono `indSinc=1`).
5. **Envelope:** `enviNFe` versão 4.00 com `idLote` de 15 dígitos (timestamp).
6. **Assinatura:** RSA-SHA1 com XML-DSIG (biblioteca `xml-crypto` + `node-forge`), conforme exigência SEFAZ.
7. **Autenticação SSL/TLS:** mTLS com certificado A1 (.pfx) via `https.Agent` com `pfx` + `passphrase`.

✅ A estrutura geral está **correta** e compatível com o Manual de Integração do Contribuinte NF-e (versão 7.0).

---

### 5.2 Certificado A1 — carregamento e assinatura

✅ **Implementado com dupla fonte:**

```typescript
// Prioridade 1: banco de dados (Company.certA1Keystore — campo Bytes)
certBuffer = Buffer.from(nfe.company.certA1Keystore)
// Prioridade 2: arquivo local
const certPath = path.resolve('certs/tapajos-cert.pfx')
```

O certificado é usado para:
- **Assinar o XML** (xml-signer.ts): extrai chave privada e certificado via `node-forge.pkcs12`, assina com RSA-SHA1.
- **Autenticar o TLS** (nfe-emit.service.ts linha 1824): `https.Agent` com `pfx` e `passphrase` — isso configura **mTLS corretamente**.

✅ A assinatura RSA-SHA1 com XML-DSIG está implementada corretamente:
- Elemento assinado: `infNFe` (referenciado pelo `Id="NFe{chave}"`).
- Transforms: `enveloped-signature` + `C14N`.
- Digest: SHA-1.
- Assinatura: RSA-SHA1.
- KeyInfo: `X509Certificate` em base64.

---

### 5.3 `rejectUnauthorized: false` — PROBLEMA DE SEGURANÇA

❌ **PROBLEMA CRÍTICO — Desabilita validação do certificado SEFAZ.**

`nfe-emit.service.ts` linha 1827:
```typescript
rejectUnauthorized: false, // SP homologação pode usar cert auto-assinado
```

**Impacto:** Em produção, esta configuração desabilita a verificação do certificado SSL do servidor SEFAZ, tornando a conexão vulnerável a ataques man-in-the-middle. Um atacante poderia interceptar e modificar os dados da NF em trânsito.

**Correção recomendada:**
```typescript
const httpsAgent = new https.Agent({
  pfx: certBuffer!,
  passphrase: certPassword,
  rejectUnauthorized: sefazMode === 'producao', // true em produção, false em homologação
})
```

Ou, ainda melhor em produção, adicionar o certificado raiz da cadeia SEFAZ-SP como CA confiável:
```typescript
const sefazCa = fs.readFileSync('certs/sefaz-sp-ca.pem') // cadeia ICP-Brasil
const httpsAgent = new https.Agent({
  pfx: certBuffer!,
  passphrase: certPassword,
  ca: sefazCa,
  rejectUnauthorized: true,
})
```

**Fundamento:** OWASP TLS Security; Manual de Integração NF-e item 5.2.2 (uso de certificado ICP-Brasil).

---

### 5.4 Validação de retorno — cStats

✅ **Parcialmente correto.** Os cStats tratados (`nfe-emit.service.ts` linha 476):
```typescript
const autorizados = ['100', '150', '204']
```

| cStat | Descrição | Tratamento atual |
|---|---|---|
| 100 | Autorizado o Uso da NF-e | ✅ `authorized` |
| 150 | Autorizado o Uso da NF-e, mas chave duplicada | ✅ `authorized` |
| 204 | Duplicidade de NF-e | ✅ `authorized` |
| 225 | Rejeição: NF referenciada | ❌ `error` — sem mensagem específica |
| 302 | Rejeição: Certificado vencido | ❌ `error` — sem mensagem específica |
| 539 | Rejeição: CSOSN inválido | ❌ `error` — sem mensagem específica |
| 999 | Rejeição: Erro não catalogado | ❌ `error` — genérico |

⚠️ **Alerta:** O sistema mapeia qualquer cStat não listado como `NfeStatus.error`, o que está correto funcionalmente. Porém, **não há tratamento diferenciado** para cStats de rejeição por dados do destinatário (302, 539, 400-series) que poderiam orientar melhor o usuário sobre como corrigir.

---

### 5.5 Ambiente de homologação vs produção

✅ **Estrutura idêntica** — a diferença é apenas o endpoint (URL). O envelope SOAP, o schema e a assinatura são os mesmos. Correto conforme especificação SEFAZ.

---

### 5.6 Passos para ativar o certificado em produção

Ver Bloco 6 / Checklist de Ativação.

---

## 6. BLOCO 5 — INFORMAÇÕES COMPLEMENTARES (infAdic)

### 6.1 Estrutura do infAdic

✅ **Correto.** O xml-builder.ts concatena: `"I. DOC. EMITIDO..." | "II. NAO GERA..." | {buildInfoAdic output}`. O DANFE PDF também exibe os três blocos (corrigido em 29/03/2026 — anteriormente exibia apenas o buildInfoAdic sem os disclaimers fixos).

---

### 6.2 Crédito de ICMS — cálculo

✅ **Cálculo correto** para CSOSN 101/201/900.

No `buildEmitDtoFromDraft` (linhas 1620–1622):
```typescript
const pCredSN = hasCredit ? icmsSnRate : 0
const vCredICMSSN = hasCredit ? parseFloat((total * pCredSN / 100).toFixed(2)) : 0
```

O valor individual por item é calculado. No `buildInfoAdic` (linha 1748), o total é somado:
```typescript
const totalCredit = itens
  .filter(i => ['101', '201', '900'].includes(i.impostos?.icms?.csosn ?? ''))
  .reduce((acc, i) => acc + (i.impostos?.icms?.valor ?? 0), 0)
```

✅ A lógica de cálculo está correta.

**Para validar a alíquota de 1,25%:** Verificar o Anexo II da LC 123/2006 (atividade industrial/beneficiamento). A alíquota de crédito é de 1,25% para empresas na 1ª faixa de receita (até R$ 180.000/ano). Esse valor deve ser mantido atualizado no campo `Company.icmsSnRate`.

---

### 6.3 IBPT — Lei 12.741/2012

✅ **Implementado** (`nfe-emit.service.ts` linhas 1758–1764):
```typescript
const federalAmt = billingAmt * IBPT_FEDERAL_PCT / 100  // 13,45%
const estadualAmt = billingAmt * IBPT_ESTADUAL_PCT / 100  // 18,00%
```

As alíquotas são definidas em `office.config.ts` como constantes:
```typescript
export const IBPT_FEDERAL_PCT = 13.45
export const IBPT_ESTADUAL_PCT = 18.0
```

⚠️ **Alerta:** As alíquotas IBPT são **atualizadas semestralmente** pela FENACON/IBPT. Os valores 13,45% (federal) e 18,00% (estadual) precisam ser **verificados e atualizados periodicamente** via tabela IBPT vigente disponível em www.ibpt.org.br. O sistema usa valores fixos sem mecanismo de atualização automática.

**Fundamento:** Lei 12.741/2012 (Lei da Transparência Fiscal); Decreto 8.264/2014.

---

### 6.4 Referência "DEV. TOTAL DA SUA NF-E" — 5902

❌ **NÃO IMPLEMENTADO** — relacionado ao problema do `<NFref>` (Bloco 2 item 3.6).

O histórico da empresa indica o texto: `"DEV. TOTAL DA SUA NF-E XXXX DE DD/MM/YYYY"` nas informações complementares. Esse texto **não é gerado automaticamente** pelo sistema atual.

O `buildInfoAdic` (`nfe-emit.service.ts`) não inclui lógica para referência de NF de entrada.

**Impacto:** Falta de rastreabilidade e desconformidade com práticas fiscais para retorno de industrialização.

**Correção:** Adicionar à `buildInfoAdic` lógica que, para itens com CFOP 5902, inclua o texto:
```typescript
const itens5902 = itens.filter(i => i.cfop === '5902')
if (itens5902.length > 0 && nfe.refNFe) {
  parts.push(`DEV. TOTAL DA SUA NF-E ${nfe.refNFNumero} DE ${nfe.refNFDate}`)
}
```

---

## 7. BLOCO 6 — COMPLIANCE GERAL

### 7.1 Versão do layout NF-e

✅ **Correto.** O XML usa `versao="4.00"` (`xml-builder.ts` linha 141):
```typescript
.ele('infNFe', { Id: `NFe${chave}`, versao: '4.00' })
```

O cabeçalho SOAP também declara `<versaoDados>4.00</versaoDados>`. Layout 4.00 é a versão **vigente e obrigatória** desde 2019.

**Fundamento:** NT NF-e 2018/001 (obrigatoriedade layout 4.00).

---

### 7.2 `nNF` — sequenciamento e gaps

⚠️ **PROBLEMA CRÍTICO — Risco de gaps na numeração.**

O número sequencial é obtido em (`nfe-emit.service.ts` linhas 416–421):
```typescript
const lastNfe = await this.prisma.nfe.findFirst({
  where: { tenantId, companyId, series: 1, status: { not: NfeStatus.draft } },
  orderBy: { number: 'desc' },
  select: { number: true },
})
const nextNfeNumber = (lastNfe?.number ?? 0) + 1
```

**Problemas identificados:**

1. **Race condition:** Em emissões concorrentes (duas NFs emitidas simultaneamente), ambas podem obter o mesmo `nextNfeNumber`, gerando duplicata ou gap.
2. **NFs em status `error`:** NFs com status `error` após tentativa de emissão **são contadas** (`status: { not: NfeStatus.draft }`) e "consomem" o número, gerando gap permanente na sequência.
3. **Sem lock de transação:** O incremento não é atômico — há janela entre o SELECT e o UPDATE.

**Impacto:** Gaps na numeração NF-e geram obrigação de Carta de Correção ou Inutilização de NF-e no SEFAZ. A inutilização deve ser feita via WebService NFeInutilizacao4 para cada número inutilizado.

**Correção recomendada:**
```typescript
// Usar sequência atômica via PostgreSQL ou serializar com transaction
const result = await this.prisma.$queryRaw<{nextval: bigint}[]>`
  SELECT nextval(pg_get_serial_sequence('"nfe_number_seq"', 'seq')) as nextval
`
// OU usar SELECT ... FOR UPDATE dentro de uma transaction
```

Alternativamente, implementar um modelo `NfeSequence` com controle de série e usar `prisma.$transaction` com `isolation: 'Serializable'`.

**Fundamento:** Ajuste SINIEF 07/2005 cláusula 11ª (inutilização de numeração); NT NF-e 2011/001.

---

### 7.3 `cNF` — código aleatório sem persistência

❌ **PROBLEMA CRÍTICO — `cNF` gerado aleatoriamente a cada chamada.**

`xml-builder.ts` linha 34:
```typescript
const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, '0')
```

O `cNF` é gerado aleatoriamente **cada vez** que `buildChaveAcesso` é chamado. O problema é que ele é gerado novamente se o XML for reconstruído (ex.: para reemissão, DANFE, e-mail), resultando em chaves diferentes para a mesma NF.

Embora o `cNF` seja um campo de controle interno (não validado pelo SEFAZ como sequencial), a **chave de acesso deve ser única e imutável** após a assinatura. Se o XML for reconstruído por qualquer motivo, a chave mudará.

**Correção recomendada:** Persistir o `cNF` gerado no banco (campo `Nfe.cNFCode String?`) e reutilizá-lo nas reconstruções.

---

### 7.4 Validação de CNPJ/CPF do destinatário

✅ **Validação básica implementada** (`nfe-emit.service.ts` linhas 374–388):
```typescript
if (!nfe.customer.document) missing.push('CNPJ/CPF')
```

O campo é verificado como presente. No XML builder, há verificação do tamanho para distinguir CNPJ (14) de CPF (11) (`xml-builder.ts` linhas 191–195).

⚠️ **Alerta:** Não há validação do **dígito verificador** do CNPJ/CPF antes da emissão. Um CNPJ inválido gerará rejeição do SEFAZ (cStat 204 ou série 3xx).

**Correção recomendada:** Adicionar validação de dígito verificador usando algoritmo padrão antes de chamar `buildXml`.

---

### 7.5 Campo `<mod>` — modelo do documento

✅ **Correto.** `ide.ele('mod').txt('55')` (`xml-builder.ts` linha 147). Modelo 55 = NF-e. Correto.

---

### 7.6 Operações interestaduais

⚠️ **Alerta — DIFAL não implementado.**

O sistema detecta operações interestaduais (`idDest = '2'` quando `cliente.uf !== emitente.uf`, linha 154), mas **não calcula nem declara o DIFAL** (Diferencial de Alíquota, EC 87/2015).

Para a Tapajós (Simples Nacional), o DIFAL em operações interestaduais B2C é de responsabilidade do **destinatário** quando contribuinte. Para destinatário não-contribuinte, a EC 87/2015 impõe o DIFAL ao remetente (mesmo sendo SN) — porém, para serviços de industrialização B2B, os destinatários são sempre contribuintes do ICMS.

**Impacto:** Para as operações atuais da Tapajós (B2B, clientes contribuintes), o risco é baixo. Para eventual venda B2C de produto, há risco de autuação.

---

## 8. CHECKLIST DE ATIVAÇÃO DO CERTIFICADO DIGITAL

Antes de mudar `SEFAZ_ENV` para `producao`, executar todos os passos abaixo:

### Pré-requisitos
- [ ] Obter certificado A1 válido (ICP-Brasil, e-CNPJ ou e-CPF do sócio responsável) — formato `.pfx` (PKCS#12)
- [ ] Confirmar validade do certificado (mínimo 30 dias de validade)
- [ ] Confirmar que o CNPJ no certificado corresponde ao CNPJ cadastrado na empresa (campo `Company.cnpj`)

### Upload no ERP (via interface ou API)
- [ ] Acessar Configurações da Empresa no ERP
- [ ] Fazer upload do arquivo `.pfx` — o sistema salva em `Company.certA1Keystore` (campo `Bytes` no banco)
- [ ] Informar a senha do certificado — o sistema salva em `Company.certA1Password`
- [ ] Verificar que os campos foram salvos: `SELECT "certA1Keystore" IS NOT NULL, "certA1Password" IS NOT NULL FROM "Company" WHERE cnpj = '...'`

### Variáveis de ambiente
- [ ] Setar `SEFAZ_ENV=homologacao` inicialmente
- [ ] Confirmar `SEFAZ_UF=35` (São Paulo)
- [ ] NÃO setar `CERT_PASSWORD` se o certificado estiver no banco (a senha vem do banco)
- [ ] Setar `CERT_PASSWORD` apenas se usar arquivo local em `certs/tapajos-cert.pfx`

### Teste em homologação
- [ ] Emitir ao menos 3 NFs em homologação com CNPJ destinatário fictício (`11222333000181`)
- [ ] Verificar cStat = 100 nas três tentativas
- [ ] Verificar protocolo retornado (`nProt`) e salvo no banco (`Nfe.sefazProtocol`)
- [ ] Verificar XML salvo em `uploads/nfe_emitidas/` com assinatura válida
- [ ] Validar o XML gerado no validador online: https://www.nfe.fazenda.gov.br/portal/validarAssinatura.aspx

### Correções pré-produção (obrigatórias)
- [ ] Corrigir `rejectUnauthorized: false` → `true` para produção (Bloco 4 item 5.3)
- [ ] Implementar `<NFref>` para CFOP 5902 (Bloco 2 item 3.6)
- [ ] Corrigir texto "II. NAO GERA DIREITO A CREDITO FISCAL DE ISS E IPI" (Bloco 1 item 2.1)
- [ ] Resolver race condition no sequenciamento de `nNF` (Bloco 6 item 7.2)
- [ ] Persistir `cNF` no banco (Bloco 6 item 7.3)

### Ativação de produção
- [ ] Setar `SEFAZ_ENV=producao`
- [ ] Emitir primeira NF real em produção com valor baixo (NF de teste real)
- [ ] Confirmar cStat = 100 e arquivo XML salvo
- [ ] Cancelar a NF de teste se necessário (via evento evCancNFe — já implementado no sistema)
- [ ] Monitorar logs por 24h

---

## 9. CONCLUSÃO — PRONTIDÃO PARA PRODUÇÃO

**Prontidão atual: NÃO RECOMENDADO** para emissão em produção sem as correções abaixo.

### Bloqueadores críticos (must-fix antes do go-live):

| # | Problema | Arquivo / Linha | Impacto | Status |
|---|---|---|---|---|
| C1 | `rejectUnauthorized: false` em produção | nfe-emit.service.ts | Segurança — mTLS ineficaz | ✅ Corrigido 28/03/2026 |
| C2 | Race condition em `nextNfeNumber` | nfe-emit.service.ts | Gaps/duplicatas na numeração | ✅ Corrigido 28/03/2026 |
| C3 | `cNF` aleatório sem persistência | xml-builder.ts | Chave inconsistente entre reemissões | ✅ Corrigido 28/03/2026 |
| C4 | Ausência de `<NFref>` para CFOP 5902 | xml-builder.ts | Risco de rejeição SEFAZ 225 | ✅ Corrigido 28/03/2026 |
| C5 | Código de barras CODE-128 ausente no DANFE | danfe-pdf.ts | DANFE não conformante com MOC 7.0 | ✅ Corrigido 29/03/2026 |

### Alertas de conformidade (high priority):

| # | Alerta | Arquivo / Linha | Risco | Status |
|---|---|---|---|---|
| A1 | Texto "ISS e IPI" incorreto para CFOP 5902 | xml-builder.ts | Declaração fiscal incorreta | ✅ Corrigido 28/03/2026 |
| A2 | IBPT hardcoded sem atualização | office.config.ts | Lei 12.741/2012 — valores desatualizados | ✅ Corrigido 29/03/2026 — IbptService com cron semanal + API iws.ibpt.org.br |
| A3 | Sem validação de dígito verificador CNPJ | nfe-emit.service.ts | Risco de rejeição no SEFAZ | ✅ Corrigido 29/03/2026 — validate-document.ts com algoritmo mod-11 |
| A4 | DIFAL não implementado para interestaduais | xml-builder.ts | Risco para operações B2C | ⚠️ Pendente — baixo risco atual (Tapajós B2B exclusivo) |

### Conformidades confirmadas:

✅ Layout NF-e 4.00 correto
✅ CRT=1 Simples Nacional corretamente declarado
✅ CSOSN padrão 400 correto para SN
✅ IPI CST 53 correto para SN beneficiamento
✅ PIS/COFINS CST 08 correto para SN
✅ Assinatura XML-DSIG (RSA-SHA1, C14N, infNFe) correta
✅ mTLS com certificado A1 implementado (com ressalva do rejectUnauthorized)
✅ Envelope SOAP 1.2 para NFeAutorizacao4 correto
✅ `indIntermed=0` correto para operações diretas
✅ `dhSaiEnt` implementado
✅ Seções obrigatórias do DANFE presentes (exceto CODE-128)
✅ Crédito ICMS art. 23 LC 123/2006 calculado e declarado
✅ Tributos IBPT calculados (Lei 12.741/2012)
✅ Cálculo de imposto zerado no DANFE (correto para SN)
✅ Validação de campos obrigatórios do destinatário antes de emitir
✅ Sequência de NF com base na última autorizada
✅ Status `authorized` para cStat 100/150/204
✅ Envio de DANFE+XML por e-mail após emissão

---

*Documento gerado automaticamente pelo ERP Tapajós Internal Audit.*
*Fundamentação: LC 123/2006; Resolução CGSN 140/2018; NT NF-e (layout 4.00); MOC NF-e 7.0; AJUSTE SINIEF 07/2005 e 01/2015; RIPI/2010 (Decreto 7.212/2010); IN RFB 1.911/2019; Lei 12.741/2012; Convênio ICMS 142/2018; EC 87/2015.*

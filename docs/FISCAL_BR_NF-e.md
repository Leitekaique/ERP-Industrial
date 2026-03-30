# Requisitos Fiscais BR — NF-e 4.0 (Beneficiamento/Industrialização)

> Documento de referência para conformidade fiscal do ERP Tapajós.
> Baseado no Manual de Integração NF-e versão 7.0 e legislação vigente.

---

## 1. Campos Obrigatórios NF-e 4.0

### IDE (Identificação da NF-e)
| Campo | Valor padrão Tapajós | Observação |
|-------|---------------------|------------|
| `cUF` | 35 | SP |
| `cNF` | 8 dígitos aleatórios | gerado automaticamente |
| `natOp` | "Remessa p/ industrialização" | livre, mas coerente com CFOP |
| `mod` | 55 | NF-e |
| `serie` | 1 | iniciar em 1 |
| `nNF` | sequencial | iniciar em 6600 (conforme acordado) |
| `dhEmi` | ISO 8601 com tz | ex: `2024-03-25T10:30:00-03:00` |
| `dhSaiEnt` | igual a dhEmi para serviços | ✅ já implementado |
| `tpNF` | 1 | saída |
| `idDest` | 1 (interna) / 2 (interestadual) | depende UF destinatário vs emitente |
| `cMunFG` | código IBGE município do emitente | ✅ já implementado |
| `tpImp` | 1 | DANFE normal paisagem |
| `tpEmis` | 1 | emissão normal |
| `tpAmb` | 1 prod / 2 homolog | via SEFAZ_ENV |
| `finNFe` | 1 | NF-e normal |
| `indFinal` | 0 | não consumidor final |
| `indPres` | 9 | operação não presencial, outros |
| `indIntermed` | 0 | ✅ já implementado |
| `procEmi` | 0 | emissão com aplicativo próprio |
| `verProc` | "1.0" | versão do app |

### Emitente
| Campo | Observação |
|-------|------------|
| `CNPJ` | sem formatação |
| `xNome` | razão social |
| `xFant` | nome fantasia (opcional) |
| `enderEmit` completo | logradouro, número, bairro, município, UF, CEP, país |
| `IE` | inscrição estadual |
| `CRT` | 1 = Simples Nacional |

### Destinatário
| Campo | Observação |
|-------|------------|
| `CNPJ` ou `CPF` | sem formatação |
| `xNome` | razão social/nome |
| `enderDest` completo | incluindo `cMun` (IBGE) ✅ já implementado |
| `indIEDest` | 1 = contribuinte ICMS, 2 = isento, 9 = não contribuinte |

### Produto/Item
| Campo | Observação |
|-------|------------|
| `cProd` | código interno |
| `cEAN` / `cEANTrib` | **"SEM GTIN"** (string literal) se não houver GTIN — obrigatório em NF-e 4.0; omitir causa rejeição cStat 575 ✅ já implementado |
| `xProd` | descrição |
| `NCM` | 8 dígitos |
| `CFOP` | ver tabela abaixo |
| `uCom` / `uTrib` | unidade comercial e tributável |
| `qCom` / `qTrib` | quantidades |
| `vUnCom` / `vUnTrib` | valores unitários |
| `vProd` | valor total do item |
| `indTot` | 1 = compõe vNF |

### Tributação — Simples Nacional (CRT=1)
| Tributo | Campo | Valor Tapajós | Observação |
|---------|-------|---------------|------------|
| ICMS | `CSOSN` | 900 | ✅ usado — tributado com crédito |
| PIS | `CST` | 08 | ✅ não tributado — correto para industrialização |
| COFINS | `CST` | 08 | ✅ não tributado — correto para industrialização |
| IPI | — | não incide | beneficiamento por encomenda (CFOP 5124/5125) geralmente sem IPI |

**CSOSN e tags XML correspondentes (NF-e 4.0):**
| CSOSN | Tag XML | Uso Tapajós |
|-------|---------|-------------|
| **400** | `<ICMSSN102>` (orig + CSOSN apenas) | **correto para serviço de beneficiamento** — sem crédito |
| **900** | `<ICMSSN900>` (pCredSN + vCredICMSSN) | quando há crédito tributário — verificar com contador |
| 102 | `<ICMSSN102>` | tributado pelo SN sem crédito |
| 500 | `<ICMSSN500>` | com ST anterior |

> ⚠️ **CSOSN 400 vs 900**: O xml-builder usa CSOSN do cadastro do produto (default 400). CSOSN 900 gera crédito de Simples — verificar com contador se a Tapajós tem direito ao crédito para operações de beneficiamento. Não alterar sem validação contábil.

> **Tag correta para CSOSN 400**: `<ICMSSN102>` com apenas `<orig>` e `<CSOSN>` — **NÃO existe tag ICMSSN400** no schema NF-e 4.0.

**CSOSN 900 exige (quando aplicável):**
- `pCredSN` = alíquota de crédito (ex: 1.23%)
- `vCredICMSSN` = valor do crédito = `vBC * pCredSN / 100`
- `modBC` = 3 (valor da operação)
- `vBC` = base de cálculo (= vProd para CSOSN 900 sem redução)
- `pICMS` = alíquota (campo informativo)
- `vICMS` = valor ICMS (= 0 para Simples, campo informativo)

### CFOP para Beneficiamento
| CFOP | Descrição | Quando usar |
|------|-----------|-------------|
| **5124** | Industrialização para o encomendante (intra-estado SP) | **combo principal** — item de serviço, cliente SP |
| **6124** | Industrialização para o encomendante (inter-estados) | item de serviço, cliente fora SP |
| **5902** | Retorno simbólico de mercadoria utilizada na industrialização (SP) | **devolução simbólica do tecido ao cliente (SP)** |
| **6902** | Idem, inter-estados | devolução simbólica do tecido (cliente fora SP) |
| 5125 | Industrialização — material fornecido pelo próprio emitente (SP) | quando Tapajós fornece o material integralmente |
| 6125 | Idem inter-estados | |
| 5101 | Venda de produção do estabelecimento | venda direta |
| 5102 | Venda de mercadoria adquirida ou recebida de terceiros | revenda de insumos |

> **Combo padrão Tapajós**: 5124 (serviço) + 5902 (retorno simbólico do tecido), ou 6124+6902 para clientes fora de SP.

### Seção de Transporte
- `modFrete`: 0=emitente, 1=destinatário, 2=terceiros, 9=sem frete ✅
- `transporta`: CNPJ/CPF, razão social, IE, endereço (quando houver transportadora)
- `vol`: quantidade, espécie, marca, peso líquido/bruto

### Cobranças (cobr)
- `fat`: número, valor original, desconto, valor líquido
- `dup`: número, data de vencimento, valor ✅ implementado via billingTerms

### Informações Adicionais (infAdic)
- `infCpl`: disclaimers Simples Nacional ✅ auto-gerado para CRT=1
  - "Documento emitido por ME/EPP optante pelo Simples Nacional..."
  - "Não gera direito a crédito fiscal de ICMS..."

---

## 2. Cancelamento de NF-e (evento evCancNFe)

### Regras
- **Prazo**: 24 horas após a autorização (para NF-e modelo 55)
- Após 24h: necessário procedimento de **carta de anulação** + novo documento (mais complexo, fora do escopo atual)
- Justificativa: mínimo 15 caracteres, máximo 255 caracteres
- Somente NFs com status `authorized` podem ser canceladas

### Estrutura XML do evento
```xml
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110111{chave44}{seq02}">
      <cOrgao>91</cOrgao>  <!-- 91 = SVAN (ambiente nacional) -->
      <tpAmb>2</tpAmb>
      <CNPJ>{cnpjEmitente}</CNPJ>
      <chNFe>{chaveAcesso44}</chNFe>
      <dhEvento>{ISO8601_BRT}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>{numeroProtocolo}</nProt>
        <xJust>{justificativa}</xJust>
      </detEvento>
    </infEvento>
    <Signature>...</Signature>
  </evento>
</envEvento>
```

### ID do infEvento
- Formato: `"ID" + tpEvento(6) + chave(44) + nSeqEvento(2 com zeros)`
- Exemplo: `ID110111350326123456789000100550010000066001234567890124560101`

### Endpoint SEFAZ SP
- **Homologação**: `https://hom.nfe.fazenda.sp.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx`
- **Produção**: `https://nfe.fazenda.sp.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx`
- **Ambiente Nacional (fallback)**: `https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx`

### Após cancelamento
- Atualizar `Nfe.status` → `canceled`
- Criar registro `NfeEvent` com type=`cancel`
- Cancelar `Receivable` associados (se houver)
- **Não reverter estoque automaticamente** — movimentação manual ou separada

---

## 3. CC-e — Carta de Correção Eletrônica (evento evCCe)

### O que PODE ser corrigido
- Dados do transporte (transportadora, placa, volumes)
- Informações complementares (infCpl/infAdFisco)
- Natureza da operação (natOp) — **desde que não altere impostos**
- Endereço do destinatário (logradouro, bairro, número, CEP) — **não pode mudar CNPJ/CPF**
- Dados de produto sem impacto fiscal (descrição complementar)
- IE do destinatário

### O que NÃO pode ser corrigido (§ 1º-A art. 7º Convênio S/N)
- Valores (preço, quantidade, base de cálculo)
- Dados que impliquem mudança do emitente ou destinatário (CNPJ/CPF/nome)
- Data de emissão ou saída
- Qualquer variável que determine o valor do imposto

### Estrutura XML do evento
```xml
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110110{chave44}{seq02}">
      <cOrgao>91</cOrgao>
      <tpAmb>2</tpAmb>
      <CNPJ>{cnpjEmitente}</CNPJ>
      <chNFe>{chaveAcesso44}</chNFe>
      <dhEvento>{ISO8601_BRT}</dhEvento>
      <tpEvento>110110</tpEvento>
      <nSeqEvento>{1..20}</nSeqEvento>
      <verEvento>1.01</verEvento>
      <detEvento versao="1.01">
        <descEvento>Carta de Correção</descEvento>
        <xCorrecao>{texto da correção}</xCorrecao>
        <xCondUso>A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.</xCondUso>
      </detEvento>
    </infEvento>
    <Signature>...</Signature>
  </evento>
</envEvento>
```

### Regras de sequência
- Máximo 20 CC-es por NF-e
- `nSeqEvento` incrementa a cada nova CC-e da mesma NF (1, 2, 3...)
- Cada CC-e substitui a anterior (a última é a válida)
- Prazo: até o prazo de guarda do documento (5 anos)

---

## 4. Verificação de Conformidade — Status Atual

| Requisito | Status | Observação |
|-----------|--------|------------|
| CSOSN 900 correto com pCredSN/vCredICMSSN | ✅ | corrigido (X.2) |
| PIS/COFINS CST 08 | ✅ | corrigido (X.1) |
| dhSaiEnt no IDE | ✅ | corrigido (X.4) |
| cMun nos endereços emit/dest | ✅ | corrigido (X.5) |
| cMunFG no IDE | ✅ | corrigido (X.6) |
| indIntermed no IDE | ✅ | corrigido (X.7) |
| marca nos volumes | ✅ | corrigido (X.8) |
| indPag no pagamento | ✅ | corrigido (X.9) |
| Disclaimers SN no infAdic | ✅ | corrigido (X.10) |
| CEST suportado | ✅ | corrigido (X.11) |
| modFrete correto via freightPayer | ✅ | corrigido (X.12) |
| cMun destinatário via municipioCodigo | ✅ | corrigido (X.13) |
| cobr/fat/dup no XML | ✅ | corrigido (X.3) |
| Cancelamento com evento XML correto | 🔲 | a implementar (a23) |
| CC-e com evento XML correto | 🔲 | a implementar (a23) |
| Assinatura digital real (certificado A1) | 🔲 | ativado via SEFAZ_ENV=producao |
| Envio SOAP real ao SEFAZ | 🔲 | xml-sender.ts ainda simulado |

### Rejeições SEFAZ mais comuns
| cStat | Causa | Solução |
|-------|-------|---------|
| 202 | Falha Schema XML | Tag faltando, ordem errada, valor fora do tipo |
| 225 | CNPJ do Emitente inválido | Verificar cadastro no SEFAZ |
| 241 | nNF+série já emitido | Número duplicado — verificar sequência |
| 575 | cEAN/cEANTrib inválido | Deve ser "SEM GTIN" para produtos sem código |
| 538 | CSOSN incompatível com CRT | CRT=1 com CST de regime normal (ou vice-versa) |
| 656 | CFOP inválido para operação | CFOP de entrada em NF de saída |

### idDest (identificação do destino)
- `1` = operação interna (emitente e destinatário no mesmo estado)
- `2` = operação interestadual
- `3` = com exterior

> ⚠️ Atualmente `idDest` está fixo em `1` no xml-builder.ts (linha 153). Para clientes fora de SP, deve ser `2`. A corrigir antes da produção ou ao cadastrar clientes interestaduais.

### Pontos de atenção para produção
1. **Certificado A1**: arquivo `.pfx` + senha configurados via env vars (`CERT_PATH`, `CERT_PASSWORD`)
2. **SEFAZ_ENV**: alterar de `simulator` para `producao`
3. **Numeração NF**: iniciar em 6600 (`NEXT_NF_NUMBER=6600`)
4. **Numeração duplicata**: iniciar em 3300
5. **tpAmb**: `1` (produção) vs `2` (homologação)
6. **Timeout SOAP**: usar axios com httpsAgent + certificado para mTLS

---

## 5. Obrigações de Guarda
- XML da NF-e: **5 anos** (prazo prescricional tributário)
- DANFE: não obrigatório guardar (o XML prevalece)
- Eventos (cancelamento, CC-e): **5 anos** junto ao XML da NF
- Recomendação: backup diário em nuvem ✅ (conforme plano de deploy)

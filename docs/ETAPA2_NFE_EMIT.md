# Etapa 2 — Emissão de NF-e (Modo Simulador)

## 🧩 Objetivo
Criar a estrutura para emissão de NF-e em modo **offline**, já preparada para migração à homologação SEFAZ-SP.

## ⚙️ Estrutura
- Módulo NestJS completo (`nfe-emit`)
- Simulação de assinatura digital (PKCS#12 → XMLDSIG)
- Armazenamento dos XMLs em `E:/ERP/uploads/nfe_emitidas`
- Variáveis CERT_PATH e CERT_PASSWORD prontas para .env

## 🧾 Migração para Homologação SEFAZ-SP
1. Obter **schema SEFAZ v4.00**
2. Implementar assinatura real XMLDSIG (biblioteca `xml-crypto`)
3. Criar integração SOAP com os endpoints:
   - Autorização: `https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx`
   - Retorno: `https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx`
4. Substituir `xml-sender.ts` para uso real do WS
5. Atualizar variáveis `.env` com caminho e senha do certificado
6. Rodar testes com SEFAZ em modo **Homologação**
7. Após sucesso, alterar `tpAmb` de `2` (homologação) para `1` (produção)

# Pendências — ERP Tapajós

> Lista de pendências identificadas durante os testes.
> ✅ = resolvido | 🔲 = pendente | ⚠️ = parcial

---

## NF-e Entrada
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 1.1 | Lista de NFs importadas: adicionar coluna com número da NF `<nNF>` do XML | Média | ✅ |

---

## Produtos
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 13.1 | Lista de produtos: coluna "Empresa Origem" restaurada | Alta | ✅ |
| 13.2 | Form de produto: campo "Preço" editável manualmente (insumos incluídos) | Alta | ✅ |

---

## Estoque
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 14.1 | Após conversão de unidade, atualiza automaticamente (sem F5) | Média | ✅ |
| 14.2 | Resultado de conversões: máximo 2 casas decimais, arredondado para cima (ceil) | Média | ✅ |
| 19.1 | Stock-in manual só funcionava quando empresa origem = Tapajós | Alta | ✅ |
| 19.2 | Form "Movimentar": campos "Empresa Atual" e "Empresa Destino" removidos | Média | ✅ |
| 19.3 | Data do evento com timezone corrigida | Média | ✅ |
| E.1 | Form "Movimentar": adicionar campo de upload de imagem (foto do romaneio de entrada) | Baixa | ✅ |
| E.2 | Form "Movimentar" (Saída): adicionar flag **"Gerar cobrança"** que cria Receivable (preço × quantidade) ao confirmar saída | Alta | ✅ |

---

## NF-e Draft
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 15.2 | Seleção de transportadora removida do draft — definida apenas na finalização | Baixa | ✅ |

---

## Emissão NF-e
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 7.1 | Lista: destinatário vazio — corrigido | Alta | ✅ |
| 7.2 | Tela de finalização: emitente auto-preenchido com dados da Tapajós | Alta | ✅ |
| 7.3 | Lista: separar valor em **Valor Total NF** e **Valor de Cobrança** (itens MO + insumos) | Média | ✅ |
| 7.4 | Revisar campos cobrança/fatura: campos faltando + conexão com cadastro do cliente | Alta | ✅ |
| 16.1 | Transportadoras cadastradas agora aparecem como dropdown na Aba 4 do rascunho | Alta | ✅ |
| G.1 | Natureza de operação: dropdown com predefinidos + campo livre editável | Alta | ✅ |
| G.1b | NatOp: opções "Remessa grátis" e "Reprocesso" adicionadas | Baixa | ✅ |
| G.2 | XML acessível após emissão — botão XML na lista, download via axios blob | Alta | ✅ |
| G.2b | PDF da NF emitida não é gerado (DANFE) — visualização e download pendentes | Alta | ✅ |
| G.3 | Ao emitir NF: enviar PDF (DANFE) + XML automaticamente ao cliente e ao escritório contábil da Tapajós<br>*(teste provisório: kaique_310@hotmail.com — validar antes de configurar e-mail definitivo)* | Alta | ✅ |

---

## Financeiro — A Receber
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 8.1 | Receivable auto-gerado após emissão de NF: usa `billingTerms` do cliente. `dia15`/`dia20` acumulam no mesmo receivable mensal; termos por NF (`7d`,`15d`,`28d`,`45d`) criam um por emissão | Alta | ✅ |

---

## Financeiro — Contas a Pagar
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| 11.1 | NF de consumo importada não gera conta a pagar (verificar `<infCpl>` e datas; criar PENDENTE se ausente) | Alta | ✅ |
| 17.1 | NF de compra de insumos não gera contas a pagar (usar `<dup>` do XML; criar PENDENTE se ausente) | Alta | ✅ |

---

## Financeiro — Duplicata / Faturamento
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| F.1 | Gerar PDF da duplicata/fatura automaticamente no modelo padrão Tapajós (ver exemplos 3236 e 3237 em `docs/`) com campos: nº fatura, data emissão, vencimento, sacado, endereço, NF(s) referenciadas, valor total, valor por extenso, dados bancários | Alta | ✅ |
| F.2 | Enviar PDF da duplicata ao cliente e ao escritório contábil automaticamente após geração | Alta | ✅ |
| F.3 | Fluxo E (sem NF): flag "Gerar cobrança" na saída de estoque cria Receivable que alimenta o billing conforme regra do cliente (acúmulo mensal dia 15/20 ou individual por prazo) | Alta | ✅ |

---

## Clientes — Cadastro
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| C.1 | Campo "e-mail contador" removido do form — é e-mail padrão Tapajós | Média | ✅ |
| C.2 | Campo modo de cobrança substituído por dropdown `billingTerms` (6 opções) | Alta | ✅ |
| C.2b | Bug de validação no PATCH: `UpdateCustomerDto` usava `PartialType` — campos obrigatórios impediam salvar | Alta | ✅ |
| C.3 | Cliente criado via importação de NF: indicar campos faltantes e bloquear emissão de NF de saída até preenchimento | Alta | ✅ |

---

## Backend / Infra
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| I.1 | Container usa `dist/main.js` pré-compilado. Mudanças em `src/` exigem rebuild: `./rebuild-api.sh` | - | ✅ (script criado) |

---

## XML NF-e — Conformidade Fiscal (Beneficiamento)
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| X.1 | PIS/COFINS CST default corrigido de '07' para '08' (NT — não tributado, correto p/ beneficiamento) | Alta | ✅ |
| X.2 | CSOSN 900 agora gera `<ICMSSN900>` com pCredSN/vCredICMSSN (antes usava ICMSSN102 incorretamente) | Alta | ✅ |
| X.3 | Seção `<cobr>` (fatura + duplicatas) adicionada ao XML — gerada a partir de billingTerms do cliente | Alta | ✅ |
| X.4 | `<dhSaiEnt>` adicionado ao IDE (data/hora saída = emissão para serviços) | Alta | ✅ |
| X.5 | `<cMun>` adicionado nos endereços emit e dest (código IBGE do município) | Alta | ✅ |
| X.6 | `<cMunFG>` adicionado ao IDE (com fallback para município do emitente) | Alta | ✅ |
| X.7 | `<indIntermed>` adicionado ao IDE | Média | ✅ |
| X.8 | `<marca>` adicionado nos volumes de transporte | Média | ✅ |
| X.9 | `<indPag>` adicionado na seção pagamento | Média | ✅ |
| X.10 | Disclaimers Simples Nacional auto-gerados no infAdic para CRT=1 | Média | ✅ |
| X.11 | `<CEST>` suportado nos itens (campo opcional `cest` no produto) | Média | ✅ |
| X.12 | modFrete agora usa freightPayer (enum) → código NF-e correto (antes usava freightType=undefined) | Alta | ✅ |
| X.13 | `municipioCodigo` do cliente agora passado para `<cMun>` do destinatário | Alta | ✅ |

---

## Dashboard
| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| D.1 | Vários ajustes a definir após testes completos do dashboard | Média | ✅ |

---

## Log de Testes

| Data | Cenário | Status |
|------|---------|--------|
| 2026-03-25 | Fluxo A: entrada → produto → processo → estoque → NF saída | Parcialmente OK — pendências 7.x, 8.1 |
| 2026-03-25 | Fluxo B: NF consumo → fornecedor → contas a pagar | NOK — pendência 11.1 |
| 2026-03-25 | Fluxo C: insumos → conversão → NF saída → contas a pagar | Parcialmente OK — pendências 13.x, 14.x, 16.1, 17.1 |
| 2026-03-25 | Fluxo D: venda — produto criado, estoque OK após 19.1, NF pendente G.2b/G.3 | Parcialmente OK |
| 2026-03-25 | Correções G.1, G.2, 19.1–19.3 aplicadas — reteste necessário | Aguardando reteste |
| 2026-03-25 | Fluxo E (sem NF): descrito, aguarda implementação E.2 e F.1–F.3 | Não testado |
| 2026-03-25 | Sessão 2: C.1/C.2, 8.1, 13.1, 13.2, 14.1, 14.2, 15.2, 16.1 corrigidos | Aguardando reteste |

---


## Pendências 26/03/26
| ID | Descrição | Prioridade | Status |
|----|-----------|-----------:|--------|
| a1 | Busca e ordenação por empresa origem e processo na lista de produtos | Média | ✅ |
| a2 | Lista de transportadoras: botões editar/excluir e remoção coluna RNTRC | Média | ✅ |
| a3 | Ordenação por todas colunas na lista de processos | Média | ✅ |
| a4 | Agrupamento por processo/NF no estoque, com colapso igual ao de empresa | Média | ✅ |
| a5 | Email na lista de clientes/fornecedores; highlight para dados incompletos | Média | ✅ |
| a6 | Campo cód. IBGE no cadastro de fornecedores | Média | ✅ |
| a7 | Coluna Qtd na lista NF emit mostra `—` quando não preenchida pelo usuário | Média | ✅ |
| a8 | NF emit: botão Excluir (draft), Cancelar (autorizada ≤24h), CC-e (placeholder) | Média | ✅ |
| a9 | Ordenação e busca por todas colunas na lista NF entrada | Média | ✅ |
| a10 | Histórico de alterações para payables, receivables e faturas | Média | ✅ |
| a11 | Botão de edição nas listas de payables e receivables | Média | ✅ |
| a12 | Aba faturamento: painel com NFs emitidas sem fatura gerada, agrupado por cliente | Média | ✅ |
| a13 | Botão "Fatura Paga" com data do clique + e-mail para escritório contábil | Média | ✅ |
| a14 | Dashboard: faturamento usa soma de itens PMO+INSUMO, não totalInvoice | Média | ✅ |
| a15 | Dashboard: gráfico de quantidades produzidas e fluxo de caixa | Média | ✅ |
| a16 | Importar planilha `Tabela de Preços.xlsx` de `/docs` — **a alinhar formato antes** | Baixa | ✅ |
| a17 | Ajuste fino no layout do DANFE e da fatura | Baixa | ✅ |
| a18 | Lista NF entrada: remover prefixo `1-` da coluna Nº NF | Baixa | ✅ |
| a19 | Form Nova NF: dropdown clientes/fornecedores, pré-fill cobrança, aba inf. complementares | Baixa | ✅ |
| a20 | Acesso gerente (role): estoque, processos, dashboard, NF emit, financeiro | Baixa | ✅ |
| a21 | Saldo conta corrente + projeção futura | Baixa | ✅ |
| a22 | Projeção de caixa no dashboard (histórico + percentuais) | Baixa | ✅ |
| a23 | Formulários de cancelamento de NF-e e CC-e com geração de XML/PDF | Baixa | ✅ |
| a24 | Histórico financeiro geral (a receber + a pagar + faturas) | Baixa | ✅ |
| a25 | Cards de totalizadores no cabeçalho de A Pagar (igual A Receber) | Baixa | ✅ |
| a26 | Pesquisa critérios fiscais BR: campos, impostos, naturezas de operação | Baixa | ✅ |
| a27 | Estoque: somatório de qtd nas linhas agrupadores (empresa, processo, NF) | Baixa | ✅ |
| a28 | Dashboard: filtro de processo e empresa nos gráficos | Baixa | ✅ |
| a29 | Dashboard: card contas a pagar e filtro de data em todos os cards | Baixa | ✅ |
| a30 | Dashboard: card saldo (considerando que o input do saldo atual será fornecido no domingo) | Baixa | ✅ |
| a31 | Importar XMLs históricos de NFs emitidas para popular dashboard (botão "Importar XML histórico" na lista NF-e, aceita múltiplos arquivos) | Baixa | ✅ |
| a32 | no form de emissao de nf deixar como padrão o frete por conta do destinatário | Baixa | ✅ |
| a33 | criação das visulizações do gerente (opçao mobile) | Baixa | ✅ |
| a33 | formulário de emissão de Nf meio confuso, acho legal por o "nome" de campo para ficar mais claro (assim como nos outros forms) e sinto que muitas informações que serão colcoadas na nf (pdf e xml) não aparecem no form sinto que mesmo que já esteja pre preenchido seria legal o usuario ver esses dados para garantir que esta tudo ok| Baixa | ✅ |
| a34 | ao clicar em pagar na aba a pagar, não vi nenhuma ação além da baixa do item (deveria refletir no grafico do dashboard nos cards, no card de saldo) o historico não registra a data de pagamento | Baixa | ✅ |
| a35 | as nf's (itens) em contas a receber, depois que forem adicionados a uma fatura deveriam ser unificados e ficar sob um unico item, pois o recebimento vai acontecer refente a uma fatura, seria legal ter uma coluna NF's tambem nessa lista, o restante pode manter como está para recebimentos sem nf/fatura (itens adicionados manualmente)  | Baixa | ✅ |
| a36 | nao é possivel criar um recebivel manualmente | alta | ✅ |
| a37 | em todos formularios deixar em negrito os campos obrigatorios | alta | ✅ |
| a38 | adicionar coluna NF na lista recebiveis | alta | ✅ |
| a39 | melhorar o form de emissão, ser mais completo, mais proximo do padrão dos outros forms | alta | ✅ |
| a40 | nas tabelas de historico (produção e financeiro) adicionar ordenaçaõ nas colunas| alta | ✅ |
| a41 | nas tabelas de historico (produção e financeiro) e na aba estoque adicionar um campo para filtrar que filtra todas colunas | alta | ✅ |
| a42 | no nfeform que é quando a emissão da nf é feita sem ser apartir do estoque poderia ter o mesmo layout adotado para o nfeemitfromstockpage | alta | ✅ |
| a43 | no nfedraftdetailpage apenas o nome e o cnpj da empresa selecionada está sendo importado, no nfeemitformfromstock, não são importados os dados: IE, UF, Telefone, bairro, o csosn e a data na aba cobrança não é a data definida pelo cadastro do cliente em prazo de vencimento | ✅ |
| a44 | adicionar um botão "receber" para a fatura completa na pagina a receber, não apenas item por item da fatura, assim o usuário pode dar baixa na fatura (conjunto de nfs) de uma só vez | alta |  ✅ |
| a45 | formulario NfeDraftDetailPage vem com dados de valores usando "." como separador decimal, mas caso eu faça um ediçao e ele apague, não consigo digitar o "." e se uso a "," da um erro e nao consigo criar o draft, queria que o padrão de digitação ficasse "," para todos campos e isso não gerasse erros | alta |  ✅ |
| a46 | NfeemitfromstockPage e nfeform deveria ter um campo mostrando o numero da nf que esta sendo editada/emitida |  ✅ |
| a47 | verifcar questão do numero na seção duplicata do pdf se varia ou se mantem em 1 |  ✅ |
| a48 | verificar possiveis erros de preenchimento e gerar mensagens de erro em portugues para o usuário (ex. a essa nf ja foi importada) e tambem mensagnes de erro na emissão da nf, mensagens relacionada a conexão com a sefaz aqui a ideia é ficar bem user friendly |  ✅ |
| a49 | faça uma pesquisa relacionada a declaração de impostos em nf de empresas optante pelo simples nacional do brasil, no exemplo da tapajos não emitimos nf cobrando serviços, mas as vezes aplicamos insumos no serviço e cobramos por esse insumo em uma linha separada na nf (cfop 5124), em outros casos (mais raros) produzimos e vendemos uma malha (cfop 5101) nenhum desses dois casos há necessidade de declaração de impostos na nf? nessa pesquisa fiscal o CEST é um parametro necessário na seção item? me de uma resposta bem completa e embasada  vou colar o que vinha escrito no quadro de informações complementares das nf emitidas no erp anterior INFORMAÇÕES COMPLEMENTARES; I. DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL; II. NAO GERA DIREITO A CREDITO FISCAL DE ISS E IPI; DEV. TOTAL DA SUA NF-E 21767 DE 20/01/2026; PERMITE O APROVEITAMENTO DO CREDITO DE ICMS NO VALOR DE R$ 14,09 CORRESPONDENTE A ALIQUOTA DE 1,25%; NOS TERMOS DO ART. 23 DA LEI COMPLEMENTAR 123/2006; Trib. aprox R$ 431,78 (13,45%) Federal e R$ 577,85 (18,00%) Estadual Fonte: IBPT.| alta |  🔲 |
| a50 | na pagina de faturas, pensando em um unico cliente, se em um mesmo periodo emitirmos nf para ele em que os prazos de cobranças são diferentes, isso deveria ser refletido em mais uma fatura (ex. dia 27/03 emiti uma nf com prazo de 15 dias, no mesmo dia o cliente pediu um outro serviço que o prazo é de 7 dias) nesse caso eu deveria poder gerar duas faturas diferentes para esse cliente (levando em consideração que eu fizesse a mudança do prazo de pagamento no cadastro dele entre emissao de notas) |  ✅ |
| a51 | necessário criar uma pagina 2 para o danfe, pois haverão nf que os dados dos produtos não caberão em uma folha, a pagina 2 em diante reproduz a pagina 1 sem as seções destinatario, fatura, calculo do imposto, trasnportador e dados adicionais, mas mantem dados do produto que se torna quase a pagina toda |  ✅ |
| a52 | no pdf gerado anteriormente no antigo erp havia um codigo de barras acima da chave de acesso, isso tambem ta previsto aqui? depois que for feita a conexão com a Sefaz |  🔲 |
| a53 | no nfeform e nfeemitfrom stock, criar um botão "ver prévia" onde o usuario pode ver como está o danfe com base nas infos preenchidas formulário, antes de fazer a emissão da NF  |  ✅ |
| a54 | problema da virgula no nfedraftdetailpage segue, colunas qtd e v. unit, se eu adiciono "," não salva e não consigo usar o "."  |  ✅ |
| a55 | coluna pago em  na abas a receber não está preenchido com a data que o pagamento é realizado, verificar "a pagar" para garantir que está ok e adicione essa coluna "data de pagamento no historico" financeiro   |  ✅ |
| a56 | faturas trazer tambem a data de pagamento dela (nova coluna) e a coluna periodo a data deve estar no formato dd/mm/yyyy (assim vai enviar a data no formato certo para vencimento em "a receber")   |  ✅ |
| a57 | no formulario de emissão de nf na parte inferior do form a quantidade total deveria incluir apenas os itens de cfop 5902 (são os unicos produtos fisicos, o restante é serviço ou insumo aplicado ao produto). total produto e total nf atualmente trazendo o mesmo valor, mas deveriam diferentes e deveria ter mas um total, total serviços e insumos (total nf é total geral, produtos, serviços, insumos, frete se houver; total produtos é total de itens 5902; total serviços e insumos é todo restante)   |  ✅ |
| a58 | Adicionar na aba transporte a possibilidade do emitente somar o valor cobrado pelo frete (campo de preenchimento pelo usuário que será somado no total de nf e na cobrança), campo frete foi adicionado mas o que é inputado nele não está indo para o xml e danfe. o valor ali preenchido deveria ir para valor do frete e somar o valor do frete no total da nf e no total cobrado |  ✅ |
| a59 | Na aba dashboard o top clientes trás o somatorio do valor total das nfs faturadas e não o valor real de cobrança |  ✅ |
| a60 | Na aba dashboard acredito que seria legal trazer mais informações sobre a produção, uma tabela talvez (empresa, processo, qtd) algo que pudesse gerar insigths para o gerente. para o fluxo de caixa talvez uma tabelhinha tambem, ultimas entradas e saidas |  ✅ |
| a61 | ao descrever a pendencia a61 me lembrei que no "a pagar" nós não temos uma coluna de categoria, e acho que isso seria muito legal pensando no controle interno, assim o usuário define as categoria e é possivel ter uma visão de gastos por categoria |  ✅ |
| a62 |  pensando na interface com o usuário, ao emitir a nf, dar um retorno visual positivo de nf emitida e email enviado, assim que essas ações forem concluidas |  ✅ |
| z1 | guia para o suporte/matenedor do sistema | baixa | ✅ | 
| z2 | treinamento/guia para o usuário (contemplar inicialização) | baixa | ✅ | 
| z3 | como pegar o token do ibtp | - | ✅ (acesse iws.ibpt.org.br → cadastro → copie o token → adicione `IBPT_TOKEN=...` no .env.dev; sem token o sistema usa defaults 13,45%+18%) |
| z4 | resolver o alerta sobre o icms (definir percentual hardcoded, talvez já tenha sido ajustado) | - | ✅ (icmsSnRate vem do cadastro da empresa; quando 0 o crédito simplesmente não aparece no infAdic — nenhum alerta gerado) |
| z5 | script para salvar dados na localmente/nuvem | - | ✅ (`backup-erp.sh` criado na raiz do projeto; para automação: `crontab -e` → `0 12 * * * /caminho/backup-erp.sh`) |
| z6 | todas listas devem ter paginação com 50 itens (exceto o estoque) | - | ✅ (ReceivablesList, PayablesList, BillingList, FinanceiroHistoricoPage — todas com 50 itens/pág + ordenação por coluna) |

## Sessão de duvidas de preparação para o deploy
-1. Onde estão sendo salvos os arquivos? E todos os registros?
-2. Como eu faria para consultar a base de dados depois?
-3. Estou salvando todos os registros necessários? Segundo os direcionais fiscais vigentes no brasil?
-4. Ao fazer essa importação dos dados de processo que coloquei nas pendencias, esses dados serão transferidos juntamente com o aplicativo, quando eu transferir tudo pro computador do usuário, ou deveria fazer isso direto no computador dele?
-5. Existe uma solução para armazenar esses dados em dois locais (localmente na máquina do usuário e diariamente ao 12h fazer um backup na nuvem)?
-6. Agora que está praticamente tudo ok, segunda feira pretendo fazer o deploy, vamos construir um plano? Me ajude com isso, como comentei anteriormente, nunca fiz um deploy de algo tão grande como isso, gostaria de tomar todos os cuidados e garantir uma implementação tranquila, sem preguiça com muita preocaução atendendo todas boas práticas possíveis.
-7. Para o deploy é importante lembrar que vamos ter que definir uma numeração de início para emissão das NF's (algo em torno de 6600) e duplicata tambem (em torno de 3300).
-8. Como fazer a conexão com o certificado digital será um ponto importante tambem.
-9. Elaborar o treinamento e documento de consulta para o usuário.
-10. São varias duvidas como voce pode ver, se voce puder ir me guiando e registrando todos pontos importantes em um deploy como esse seria ideal
-11. O segundo acesso do gerente: nessa parte tenho diversas duvidas então vamos criar e ver juntos como fica, lembrando que para esse acesso ele será feito principalmente por celular


_Atualizado em: 2026-03-26 (sessão 6)_

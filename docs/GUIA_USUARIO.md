# Guia do Usuário — ERP Tapajós

> Documento de referência para o uso diário do sistema ERP Tapajós.
> Escrito em linguagem direta para o gestor operacional.
> Última atualização: março de 2026.

---

## Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Primeiro Acesso](#2-primeiro-acesso)
3. [Cadastros](#3-cadastros)
4. [Estoque](#4-estoque)
5. [Emissão de NF-e](#5-emissão-de-nf-e)
6. [NF-e Entrada (Importação de XML)](#6-nf-e-entrada-importação-de-xml)
7. [A Receber](#7-a-receber)
8. [Faturamento (Duplicatas)](#8-faturamento-duplicatas)
9. [A Pagar](#9-a-pagar)
10. [Histórico Financeiro](#10-histórico-financeiro)
11. [Dashboard](#11-dashboard)
12. [Acesso Gerente (Celular)](#12-acesso-gerente-celular)
13. [Dicas Práticas — Fluxos do Dia a Dia](#13-dicas-práticas--fluxos-do-dia-a-dia)
14. [Inicialização no Computador de Produção](#14-inicialização-no-computador-de-produção)
15. [Backup dos Dados](#15-backup-dos-dados)

---

## 1. Visão Geral do Sistema

O ERP Tapajós é o sistema de gestão feito sob medida para a **Peletização Têxtil Tapajós**. Ele cobre todo o ciclo operacional da empresa: desde a entrada de material de clientes, passando pelo controle de estoque, registro dos processos de beneficiamento (dublagem, laminação, refile, reprocesso), até a emissão de NF-e, faturamento e controle financeiro.

### Módulos disponíveis

| Módulo | O que faz |
|--------|-----------|
| **Estoque** | Controla entrada, saída e conversão de unidade dos materiais em cada depósito |
| **Processos** | Cadastra os serviços prestados por cliente (dublagem, laminação, etc.) |
| **Produtos** | Catálogo de produtos e insumos por cliente, com SKU, NCM e preço |
| **NF-e Saída** | Emite notas fiscais eletrônicas direto para a SEFAZ-SP |
| **NF-e Entrada** | Importa XMLs de fornecedores e clientes para registrar entradas de material |
| **A Receber** | Títulos gerados após emissão de NF ou saída de estoque faturada |
| **Faturamento** | Agrupa recebíveis em duplicatas mensais, gera PDF e envia ao cliente |
| **A Pagar** | Contas a pagar criadas na importação de NF de fornecedor ou manualmente |
| **Histórico Financeiro** | Visão consolidada de tudo: recebimentos, pagamentos e faturas |
| **Dashboard** | Painel executivo com faturamento, gráficos, top clientes e projeção de caixa |

---

## 2. Primeiro Acesso

### Abrindo o sistema

1. Certifique-se de que o **Docker Desktop** está rodando (ícone na bandeja do sistema, sem erro).
2. Abra o navegador (Chrome ou Edge) e acesse: **http://localhost:5173**
3. Na tela de login, informe seu usuário e senha cadastrados.
4. Clique em **Entrar**.

> **Dica:** Se a tela não abrir ou aparecer erro de conexão, avise o suporte técnico. O sistema precisa dos serviços Docker no fundo — você não precisa mexer nisso, mas eles precisam estar em execução.

### Navegação geral

O menu lateral esquerdo dá acesso a todos os módulos. Clique no nome do módulo para acessá-lo. A tela atual fica destacada no menu.

### Configurando o Saldo da Conta Corrente

Ao abrir o Dashboard pela primeira vez, o card **Saldo CC** aparecerá com traço (—). Para configurar:

1. Clique no ícone de lápis ao lado do valor no card Saldo CC.
2. Digite o saldo atual da conta corrente da Tapajós (use vírgula como separador decimal, ex: `15000,00`).
3. Pressione **Enter** ou clique no ícone de confirmação.

> **Dica:** O saldo CC fica salvo no navegador. Atualize sempre que fechar o mês ou após movimentações relevantes. Esse valor alimenta a projeção de caixa dos próximos 3 meses.

---

## 3. Cadastros

Antes de operar, os cadastros básicos precisam estar corretos. Acesse cada um pelo menu lateral.

### 3.1 Clientes

Menu: **Clientes**

1. Clique em **Novo cliente**.
2. Preencha os campos obrigatórios (em negrito no formulário): **Razão Social**, **CNPJ**, **UF**, **Município**, **Código IBGE do município**, **IE**, **Endereço**, **E-mail**.
3. No campo **Prazo de cobrança (billingTerms)**, selecione a regra desse cliente:
   - `dia15` — acumula recebível mensal com vencimento no dia 15
   - `dia20` — acumula recebível mensal com vencimento no dia 20
   - `7d` / `15d` / `28d` / `45d` — cria um recebível individual por NF emitida, vencendo no prazo indicado a partir da emissão
4. Clique em **Salvar**.

> **Atenção:** O campo **billingTerms** determina como os recebíveis e as duplicatas serão gerados após a emissão de NFs. Configure com cuidado — se errar, os vencimentos ficarão incorretos.

> **Dica:** Clientes criados automaticamente via importação de XML podem ter dados incompletos. O sistema destaca esses clientes na lista. Complete os dados antes de emitir NF para eles.

### 3.2 Fornecedores

Menu: **Fornecedores**

1. Clique em **Novo fornecedor**.
2. Preencha Razão Social, CNPJ, UF, Município, Código IBGE, Endereço e E-mail.
3. Clique em **Salvar**.

### 3.3 Produtos

Menu: **Produtos**

Os produtos ficam vinculados a um cliente (empresa origem). São usados nos itens da NF-e e no controle de estoque.

1. Clique em **Novo produto**.
2. Selecione a **Empresa Origem** (cliente dono do material).
3. Preencha: Nome, SKU, NCM (8 dígitos), CFOP, Unidade, Preço unitário.
4. Para insumos, o preço pode ser editado diretamente no formulário.
5. Clique em **Salvar**.

> **Dica:** O NCM é obrigatório para emissão de NF-e. Se não souber, consulte a tabela NCM da SEFAZ ou o contador.

### 3.4 Depósitos (Warehouses)

Menu: **Estoque > Depósitos**

1. Clique em **Novo depósito**.
2. Informe o nome (ex: "Galpão Principal", "Área de Insumos").
3. Clique em **Salvar**.

### 3.5 Transportadoras

Menu: **Transportadoras**

1. Clique em **Nova transportadora**.
2. Preencha Nome, CNPJ e demais dados.
3. Clique em **Salvar**.

As transportadoras cadastradas aparecerão como opção na aba Transporte ao emitir NF-e.

### 3.6 Processos

Menu: **Processos**

Os processos são os serviços que a Tapajós presta (dublagem, laminação, refile, reprocesso). Cada processo é vinculado a um cliente.

1. Clique em **Novo processo**.
2. Selecione o **Cliente**.
3. Informe o nome do processo.
4. Clique em **Salvar**.

---

## 4. Estoque

Menu: **Estoque**

A tela de estoque mostra todos os lotes em estoque, agrupados por empresa (cliente), processo e NF de origem. Você pode expandir cada grupo clicando nele.

### 4.1 Entrada de Material (Stock-in)

Use quando chega material de um cliente para beneficiamento ou quando você comprou insumos.

1. Na tela de Estoque, clique em **Movimentar**.
2. Selecione o **Tipo: Entrada**.
3. Selecione o **Depósito** de destino.
4. Selecione o **Produto**.
5. Informe a **Quantidade** e a **Unidade**.
6. Informe a **Data** da entrada.
7. Se tiver, faça upload da foto do romaneio (opcional).
8. Clique em **Confirmar**.

> **Dica:** Ao importar um XML de NF-e de entrada, o sistema cria o lote de estoque automaticamente. Use a entrada manual apenas para casos sem NF ou para ajustes.

### 4.2 Saída de Material (Stock-out)

Use quando o material beneficiado sai da Tapajós.

1. Na tela de Estoque, clique em **Movimentar**.
2. Selecione o **Tipo: Saída**.
3. Selecione o **Lote** a baixar.
4. Informe a **Quantidade** que sai.
5. **Campo "Gerar cobrança":** marque esta flag se a saída deve gerar um recebível (valor = preço do produto × quantidade). Isso é usado no fluxo sem NF-e — quando você entrega o material e cobra depois, sem emitir nota no momento.
6. Clique em **Confirmar**.

> **Atenção:** Se você for emitir NF-e para essa saída, **não marque "Gerar cobrança"** aqui — o recebível será criado automaticamente quando a NF for emitida. Marque apenas quando a cobrança acontece sem NF.

### 4.3 Conversão de Unidade

Use quando o material muda de unidade durante o processo (ex: metros para quilos).

1. Na tela de Estoque, localize o lote desejado.
2. Clique em **Converter unidade**.
3. Informe a nova quantidade e a nova unidade.
4. Clique em **Confirmar**.

O sistema arredonda o resultado para cima com até 2 casas decimais. A lista atualiza automaticamente após a conversão.

### 4.4 Consultar Saldo

A tela de Estoque exibe a quantidade atual de cada lote. Use os filtros de empresa, processo ou NF para localizar um item específico. A coluna de quantidade no agrupador mostra o total acumulado do grupo.

Para ver o histórico completo de movimentações:
- Clique em **Histórico de Estoque** no menu ou no botão correspondente na tela de estoque.

---

## 5. Emissão de NF-e

O sistema oferece dois caminhos para emitir uma NF-e:

- **Fluxo A — NfeForm:** emissão manual, sem partir do estoque. Você preenche todos os dados na mão.
- **Fluxo B — NfeEmitFromStockPage:** emissão a partir de lotes de estoque já registrados no sistema. Mais rápido e com dados pré-preenchidos.

### 5.1 Fluxo B — Emissão a partir do Estoque (recomendado)

Menu: **NF-e > Nova NF do Estoque**

1. Selecione o **Cliente destinatário**.
2. O sistema listará os lotes de estoque disponíveis desse cliente.
3. Selecione os lotes que entrarão na nota. Para cada lote:
   - Informe a **Quantidade** que sai.
   - O **CFOP** já vem preenchido com base no cadastro do produto (ajuste se necessário).
   - O sistema identifica automaticamente os itens como tipo BASE (produto retornado), PMO (serviço/mão de obra) ou INSUMO.
4. Preencha os campos restantes no formulário:
   - **Natureza da operação:** selecione no dropdown (ex: "Retorno após industrialização") ou digite livremente.
   - Aba **Transporte:** selecione a transportadora (se houver), o **responsável pelo frete** (padrão: Destinatário) e informe o valor do frete se for cobrado.
   - Aba **Cobrança:** revise a data de vencimento e os dados de duplicata — são preenchidos automaticamente com base no cadastro do cliente.
5. Confira os totalizadores na parte inferior:
   - **Total produtos (5902):** soma dos itens de retorno físico.
   - **Total serviços e insumos:** soma dos itens de MO e insumos cobrados.
   - **Total NF:** valor total geral (produtos + serviços/insumos + frete).
6. Clique em **Ver prévia** para visualizar o DANFE antes de emitir. Confira todos os dados.
7. Se tudo estiver certo, clique em **Emitir NF-e**.
8. O sistema envia para a SEFAZ-SP. Aguarde alguns segundos.
9. Ao ser autorizada, uma tela de confirmação (overlay verde) aparece indicando:
   - NF-e autorizada com sucesso
   - Número da NF emitida
   - Confirmação de envio do e-mail ao cliente e ao escritório contábil

> **Dica:** O número da NF sendo editada aparece no topo do formulário. Confira antes de emitir para não se perder entre rascunhos.

> **Atenção:** Após emitida, a NF-e **não pode ser editada**. Correções pequenas exigem CC-e (Carta de Correção Eletrônica). Cancelamentos só são possíveis em até 24 horas após a autorização.

### 5.2 Fluxo A — Emissão Manual (NfeForm)

Menu: **NF-e > Nova NF**

Use quando não há lote de estoque cadastrado ou para casos especiais (venda de produto, etc.).

1. Clique em **Nova NF**.
2. O sistema cria um **rascunho** numerado automaticamente.
3. Na tela do rascunho, preencha as abas:
   - **Aba 1 — Emitente:** dados da Tapajós (já pré-preenchidos automaticamente).
   - **Aba 2 — Destinatário:** selecione o cliente no dropdown. Os dados de CNPJ, IE, endereço e contato são importados do cadastro.
   - **Aba 3 — Itens:** clique em **Adicionar item** para cada produto/serviço/insumo. Informe produto, CFOP, quantidade, valor unitário, NCM.
   - **Aba 4 — Transporte:** selecione transportadora, responsável pelo frete e informe o valor do frete se aplicável.
   - **Aba 5 — Cobrança:** revise vencimentos e dados de duplicata.
   - **Aba 6 — Inf. Complementares:** campos adicionais opcionais.
4. Confira os totalizadores (produtos 5902, serviços/insumos, total NF).
5. Clique em **Ver prévia** para visualizar o DANFE.
6. Clique em **Emitir NF-e** quando tudo estiver correto.

> **Dica:** Campos obrigatórios estão em negrito. Preencha todos antes de tentar emitir — o sistema mostrará mensagens de erro em português indicando o que está faltando.

### 5.3 Cancelar uma NF-e

Após autorizada, a NF-e pode ser cancelada em até 24 horas.

1. Na lista de NF-e, localize a nota autorizada.
2. Clique em **Cancelar**.
3. Informe o motivo do cancelamento (mínimo de 15 caracteres).
4. Clique em **Confirmar cancelamento**.

O XML e o PDF do evento de cancelamento são gerados e enviados automaticamente.

> **Atenção:** Após 24 horas da autorização, o cancelamento não é mais aceito pela SEFAZ. Nesse caso, utilize a CC-e para correções ou proceda com uma NF de devolução.

### 5.4 Carta de Correção Eletrônica (CC-e)

Para corrigir informações não críticas (ex: dados de transporte, informações complementares):

1. Na lista de NF-e, localize a nota autorizada.
2. Clique em **CC-e**.
3. Descreva a correção no campo de texto.
4. Clique em **Enviar CC-e**.

---

## 6. NF-e Entrada (Importação de XML)

Menu: **NF-e Entrada**

Use esta tela para importar XMLs de NF-e de fornecedores (compra de insumos, serviços consumidos) ou XMLs históricos de notas emitidas em sistema anterior.

### 6.1 Importar XML de Fornecedor

1. Acesse **NF-e Entrada**.
2. Clique em **Importar XML**.
3. Selecione o arquivo `.xml` da nota do fornecedor.
4. O sistema processa o arquivo e:
   - Cria ou atualiza o cadastro do **fornecedor** com os dados do emitente.
   - Cria os **produtos** referenciados na nota.
   - Cria um **lote de estoque** para os itens físicos recebidos.
   - Cria automaticamente uma **conta a pagar** com base nas duplicatas (`<dup>`) do XML. Se o XML não tiver duplicatas, cria uma conta a pagar com status "pendente" para você preencher o vencimento manualmente.
5. A nota importada aparecerá na lista com número, fornecedor e data.

> **Atenção:** Se você tentar importar um XML que já foi importado, o sistema avisará com uma mensagem de erro em português. Cada XML só pode ser importado uma vez.

> **Dica:** Para popular o histórico do dashboard com NFs emitidas no sistema anterior, use o botão **Importar XML histórico** na lista de NF-e de saída. Ele aceita vários arquivos de uma vez.

---

## 7. A Receber

Menu: **A Receber**

Esta tela mostra todos os títulos a receber. Os recebíveis são criados automaticamente de duas formas:

- **Após emissão de NF-e:** o sistema lê o `billingTerms` do cliente e cria o recebível com o vencimento correto.
- **Após saída de estoque com "Gerar cobrança" marcado:** o sistema cria um recebível no valor do produto × quantidade.

Você também pode criar recebíveis manualmente clicando em **Nova fatura**.

### 7.1 Entendendo a lista

A lista agrupa os recebíveis de duas formas:

- **Linhas azuis (faturas agrupadas):** recebíveis que já foram vinculados a uma duplicata (fatura). O total mostrado é o valor da duplicata inteira.
- **Linhas brancas (avulsos):** recebíveis ainda não associados a nenhuma duplicata.

Colunas principais: Vencimento, Pago em, Cliente, NF-e vinculada, Valor, Status.

### 7.2 Receber um título individual

1. Localize o título na lista (linha branca avulsa ou expanda uma fatura clicando em **Expandir**).
2. Clique em **Receber** na linha do título.
3. Um painel abre abaixo da tabela com os campos:
   - **Recebido em:** data do recebimento (padrão: hoje).
   - **Valor:** informe o valor recebido.
   - **Método:** PIX, Transferência, Boleto, Dinheiro ou Cartão.
   - **Ref.:** número do comprovante ou referência (opcional).
   - **Obs.:** observação interna (opcional).
4. Clique em **Confirmar recebimento**.

O status do título muda para **Pago** e a data de pagamento fica registrada.

### 7.3 Receber uma fatura completa ("Receber Fatura Completa")

Quando o cliente paga a duplicata inteira de uma vez:

1. Na linha azul da fatura (agrupada), clique em **Receber Fatura**.
2. Um painel verde abrirá com os campos: Recebido em, Método e Obs.
3. Preencha e clique em **Confirmar recebimento**.

Todos os títulos vinculados àquela fatura serão marcados como pagos de uma vez.

> **Dica:** Use "Receber Fatura Completa" para o fluxo normal de pagamento mensal. Use o recebimento individual só quando o cliente pagar parcialmente ou em partes.

---

## 8. Faturamento (Duplicatas)

Menu: **Faturamento**

O Faturamento agrupa os recebíveis em aberto de um cliente, por período, em uma **duplicata** (fatura numerada). O PDF da duplicata é gerado no padrão Tapajós e enviado automaticamente ao cliente e ao escritório contábil.

### 8.1 Gerar uma fatura

1. Na tela de Faturamento, clique em **Gerar fatura**.
2. Um painel abre com três campos:
   - **Cliente:** selecione o cliente no dropdown.
   - **Mês:** selecione o mês de referência.
   - **Ano:** informe o ano.
3. Clique em **Gerar**.

O sistema agrupa todos os recebíveis em aberto desse cliente no mês indicado em uma única duplicata. Recebíveis já vinculados a outra fatura não são incluídos.

> **Atenção:** Se houver NFs emitidas para o cliente sem fatura gerada, o painel laranja "NFs emitidas sem fatura gerada" aparecerá automaticamente no topo da tela, alertando quais clientes têm recebíveis soltos.

### 8.2 Baixar o PDF da duplicata

Na lista de faturas, clique em **PDF** na linha correspondente. O arquivo `duplicata-XXXX.pdf` será baixado automaticamente.

### 8.3 Enviar a fatura ao cliente

1. Na linha da fatura, clique em **Enviar**.
2. O sistema envia o PDF por e-mail ao cliente e ao escritório contábil.
3. O status muda para **Enviado** e a data de envio é registrada.

### 8.4 Marcar fatura como paga

Após receber o pagamento da duplicata inteira:

1. Na linha da fatura (status "Enviado" ou "Vencido"), clique em **Fatura Paga**.
2. O status muda para **Pago** com a data do clique registrada.
3. Um e-mail é enviado ao escritório contábil informando o pagamento.

> **Dica:** Você também pode marcar o recebimento da fatura pela aba **A Receber** usando o botão "Receber Fatura" nas linhas azuis — o efeito é o mesmo.

### 8.5 Filtros disponíveis

Use os filtros de Status, Cliente, Ano e Mês para encontrar faturas específicas. Clique em **Filtrar** para aplicar. Os totalizadores (Total, Em aberto, Enviados, Pagos, Vencidos) atualizam conforme a lista filtrada.

---

## 9. A Pagar

Menu: **A Pagar**

Esta tela mostra todos os títulos a pagar — fornecedores, despesas operacionais e outros gastos.

As contas a pagar são criadas de duas formas:
- **Automaticamente:** ao importar um XML de NF-e de fornecedor, o sistema cria os títulos com base nas duplicatas do XML.
- **Manualmente:** clique em **Novo título** para criar qualquer despesa.

### 9.1 Criar um título manualmente

1. Clique em **Novo título**.
2. Preencha:
   - **Fornecedor:** selecione ou deixe em branco para despesas gerais.
   - **Valor.**
   - **Vencimento.**
   - **Categoria:** selecione a categoria para facilitar análise de gastos (Matéria prima, Frete/Transporte, Energia elétrica, Água, Impostos, Serviços terceiros, Manutenção, Salários, Equipamentos, Material de escritório, Outros).
   - **Observação** (opcional).
3. Clique em **Salvar**.

### 9.2 Pagar um título

1. Localize o título na lista (filtre por Status = "Em aberto" se quiser ver só os pendentes).
2. Clique em **Pagar** na linha correspondente.
3. Um painel abre com os campos: Pago em, Valor, Método, Ref. e Obs.
4. Preencha o valor efetivamente pago e o método (PIX, Transferência, Boleto, Dinheiro, Cartão).
5. Clique em **Confirmar pagamento**.

O status muda para **Pago**, a data de pagamento é registrada e o lançamento reflete nos cards e gráficos do Dashboard.

### 9.3 Filtros e categorias

Use os filtros de Status, Fornecedor, período (De / Até) e Categoria para analisar gastos específicos.

Quando houver mais de uma categoria na lista filtrada, o painel **Gastos por categoria** aparece acima da tabela com o total de cada categoria.

### 9.4 Editar um título

Clique em **Editar** na linha do título para corrigir dados como vencimento, valor ou categoria. Títulos já pagos também podem ser editados para corrigir informações.

---

## 10. Histórico Financeiro

Menu: **Financeiro > Histórico**

Esta tela reúne em um único lugar todas as movimentações financeiras: recebimentos de clientes, pagamentos a fornecedores e faturas. É útil para consulta rápida e conciliação.

- Use o filtro de **período** para selecionar o intervalo de datas.
- Use o filtro de **tipo** para ver apenas entradas, apenas saídas ou ambos.
- As colunas são ordenáveis — clique no cabeçalho para ordenar.
- Use o campo de **busca** para filtrar por qualquer texto na tabela.

---

## 11. Dashboard

Menu: **Dashboard**

O Dashboard é o painel executivo. Ele mostra o resumo do mês atual (ou do mês selecionado no filtro).

### Seletor de período

No canto superior direito, selecione o **Mês** e o **Ano** e clique em **Filtrar** para visualizar qualquer mês desejado.

### Cards KPI (indicadores)

| Card | O que mostra |
|------|-------------|
| **Faturamento do mês** | Total faturado (soma de PMO + insumos nas NFs autorizadas). Variação percentual em relação ao mês anterior. |
| **NFs emitidas** | Quantidade de NFs autorizadas no mês. |
| **A receber (aberto)** | Total e quantidade de títulos a receber em aberto no mês. |
| **A receber vencido** | Total e quantidade de títulos vencidos (fica em vermelho quando há atraso). |
| **A pagar (aberto)** | Total e quantidade de títulos a pagar em aberto. |
| **A pagar vencido** | Total e quantidade de contas vencidas. |
| **Saldo CC** | Saldo da conta corrente (editável manualmente, salvo no navegador). |

### Gráfico de Faturamento

Barras dos últimos 6 meses. Use o dropdown acima do gráfico para filtrar por cliente específico.

### Top Clientes

Lista dos 5 clientes com maior faturamento no mês, com valor total e quantidade de NFs.

### Gráfico de Quantidades Produzidas

Barras dos últimos 6 meses com total de itens produzidos (beneficiados).

### Gráfico de Fluxo de Caixa

Linhas dos últimos 6 meses mostrando Entradas (recebimentos), Saídas (pagamentos) e Saldo acumulado.

### Tabela de Produção

Lista detalhada do mês: empresa (cliente), processo e quantidade. Boa referência para acompanhar o volume mensal de cada cliente.

### Últimas Movimentações de Caixa

Tabela com as últimas entradas e saídas registradas (pagamentos recebidos e efetuados), com data, contraparte e valor.

### Projeção de Caixa — Próximos 3 meses

Com base nos recebíveis e pagamentos em aberto e no saldo CC informado, o sistema projeta o saldo dos próximos 3 meses.

> **Dica:** Mantenha o saldo CC atualizado semanalmente para que a projeção seja útil.

### Alertas de Faturas Pendentes / Vencidas

Se houver faturas (duplicatas) vencidas ou enviadas e ainda não pagas, elas aparecem em um painel de alertas logo abaixo dos cards.

---

## 12. Acesso Gerente (Celular)

O sistema tem uma visão simplificada para acesso pelo celular, voltada ao perfil de **Gerente** (role MANAGER).

Nessa visão, o gerente consegue acessar:
- Estoque
- Processos
- Dashboard
- NF-e emitidas
- Financeiro (A Receber, A Pagar, Faturamento)

> **Atenção:** A visão do gerente pelo celular é de **consulta e acompanhamento**, não de operação completa. Para emitir NFs, cadastrar novos clientes/fornecedores ou importar XMLs, use o computador de trabalho com tela maior.

> **Dica:** Ao acessar pelo celular, o sistema detecta a tela pequena e adapta o layout. Caso algum botão fique escondido, role a tela horizontalmente ou utilize o modo paisagem.

---

## 13. Dicas Práticas — Fluxos do Dia a Dia

### "Emiti uma NF — e agora?"

Após a emissão de uma NF-e autorizada, o sistema já fez automaticamente:
1. Gerou o XML assinado e o DANFE (PDF).
2. Enviou o XML + PDF por e-mail ao cliente e ao escritório contábil.
3. Criou um recebível na aba **A Receber** com o vencimento calculado pelo `billingTerms` do cliente.

O que você ainda precisa fazer manualmente:
- Verificar se o recebível está correto na aba **A Receber**.
- Ao final do mês (ou quando o cliente pagar), gerar a **duplicata** na aba **Faturamento**.

---

### "Como fechar o faturamento mensal?"

1. Acesse **Faturamento**.
2. Verifique o painel laranja "NFs emitidas sem fatura gerada" — ele mostra quais clientes têm recebíveis pendentes de agrupamento.
3. Para cada cliente listado:
   a. Clique em **Gerar fatura**.
   b. Selecione o cliente, o mês e o ano.
   c. Clique em **Gerar**.
   d. Na fatura criada, clique em **PDF** para conferir o documento.
   e. Clique em **Enviar** para disparar o e-mail ao cliente e ao escritório.
4. Repita para todos os clientes do mês.

> **Dica:** Clientes com prazo `dia15` ou `dia20` acumulam todos os recebíveis do mês em um único título. Clientes com prazo por NF (`7d`, `15d`, `28d`, `45d`) podem ter vários títulos individuais — a fatura agrupa todos eles do mês.

---

### "Como registrar o pagamento de um fornecedor?"

1. Acesse **A Pagar**.
2. Filtre por Status = "Em aberto".
3. Localize o título do fornecedor.
4. Clique em **Pagar**.
5. Informe a data, o valor e o método.
6. Clique em **Confirmar pagamento**.

O Dashboard atualizará os cards de A Pagar e o fluxo de caixa.

---

### "Chegou material de um cliente — o que faço?"

1. Se veio com NF: acesse **NF-e Entrada**, clique em **Importar XML** e selecione o arquivo. O estoque é criado automaticamente.
2. Se não veio com NF: acesse **Estoque**, clique em **Movimentar**, selecione **Entrada** e preencha os dados manualmente.

---

### "O cliente pediu uma cópia da NF — como faço?"

1. Acesse **NF-e** (lista de saída).
2. Localize a NF pelo número ou cliente.
3. Clique em **PDF** para baixar o DANFE ou em **XML** para baixar o arquivo XML.
4. Envie por e-mail ou WhatsApp para o cliente.

---

### "Preciso corrigir uma NF já emitida"

- Se for **dentro de 24 horas** e a correção é grave (valor errado, destinatário errado): **Cancele** a NF e emita uma nova.
- Se já passou de 24 horas ou a correção é pequena (campo de transporte, informação complementar): use a **CC-e** (Carta de Correção Eletrônica).

> **Atenção:** A CC-e não pode corrigir valores, quantidades de produtos, destinatário, data de emissão ou CFOP. Para isso, só cancelamento (se dentro do prazo) ou NF substituta.

---

## 14. Inicialização no Computador de Produção

Esta seção é para o **primeiro uso em ambiente real**, antes de começar a operar.

### 14.1 Importar dados históricos

Antes de começar a usar o sistema para novas operações:

1. Acesse **NF-e** (lista de saída).
2. Clique em **Importar XML histórico**.
3. Selecione múltiplos arquivos XML de NFs emitidas no sistema anterior.
4. O sistema importará as notas e populará o histórico do dashboard automaticamente.
5. Repita o processo para NFs de entrada (fornecedores) na aba **NF-e Entrada**.
6. Cadastre manualmente os **clientes**, **fornecedores**, **produtos** e **processos** que ainda não foram importados automaticamente pelos XMLs.

> **Dica:** Os XMLs históricos populam os gráficos e o Top Clientes do dashboard — quanto mais XMLs importar, mais precisa será a visão histórica.

### 14.2 Definir a numeração de NF-e

O sistema inicia a numeração de NF-e a partir do maior número existente no banco + 1. Para continuar a sequência do sistema anterior (em torno de 6600):

Avise o suporte técnico para executar o procedimento de ajuste de numeração antes de emitir a primeira NF. Não tente emitir nenhuma NF antes de confirmar que a numeração está correta.

> **Atenção:** Emitir NF-e com número duplicado ou fora de sequência causa rejeição pela SEFAZ e pode gerar problemas fiscais. Confirme a numeração com o contador antes do primeiro uso em produção.

### 14.3 Definir a numeração das duplicatas (Faturamento)

As duplicatas (faturas) também têm numeração sequencial. O próximo número deve continuar de onde o sistema anterior parou (em torno de 3300). Avise o suporte técnico para ajustar a sequência antes de gerar a primeira duplicata.

### 14.4 Configurar o certificado digital A1

O certificado digital é obrigatório para emitir NF-e em ambiente real (produção). Sem ele, nenhuma nota será aceita pela SEFAZ.

Opções de configuração (o suporte técnico realiza):

**Opção A — Upload pelo sistema:**
1. Acesse **Configurações > Empresa** (ou peça ao suporte).
2. No cadastro da empresa Tapajós, há o campo **Certificado A1**.
3. Faça upload do arquivo `.pfx` e informe a senha do certificado.

**Opção B — Arquivo no servidor:**
O suporte coloca o arquivo `.pfx` na pasta `certs/tapajos-cert.pfx` e configura a senha no ambiente.

> **Atenção:** O certificado digital tem validade (geralmente 1 a 3 anos). Quando vencer, nenhuma NF poderá ser emitida até a renovação. Anote a data de vencimento e providencie a renovação com antecedência mínima de 30 dias.

> **Dica:** Após configurar o certificado, peça ao suporte para emitir uma NF de **teste em homologação** (ambiente de testes da SEFAZ) para confirmar que tudo está funcionando antes de ir para produção.

### 14.5 Verificar o ambiente da SEFAZ

Confirme com o suporte que a variável `SEFAZ_ENV` está definida como `producao`. Em ambiente de desenvolvimento ou teste, ela pode estar como `simulator` (sem conexão real) ou `homologacao` (SEFAZ de testes). NFs emitidas em homologação não têm validade fiscal.

---

## 15. Backup dos Dados

### Onde os dados ficam armazenados

Todos os dados do ERP ficam em dois lugares:

1. **Banco de dados PostgreSQL** (dentro do Docker): cadastros, estoques, NFs, financeiro, tudo.
2. **Pasta `uploads/nfe_emitidas/`** no computador: XMLs e PDFs das NFs emitidas.

> **Dica:** Se o computador parar de funcionar e não houver backup, todos os dados são perdidos. Configure o backup antes de começar a usar em produção.

### Backup manual

O suporte técnico executa este comando para gerar um arquivo de backup do banco:

```
docker exec erp_db pg_dump -U postgres erp > backup_YYYYMMDD.sql
```

Salve esse arquivo em um HD externo ou serviço de nuvem.

### Backup automático diário (recomendado)

O suporte técnico pode configurar um backup automático diário às 12h que:
1. Gera um arquivo `.sql.gz` do banco de dados.
2. Salva localmente na pasta de backups.
3. Remove automaticamente arquivos com mais de 30 dias (para não lotar o disco).

### Backup na nuvem

Para garantia adicional, o suporte pode configurar o envio automático dos backups para um serviço de armazenamento em nuvem (Google Drive, OneDrive ou similar) após a geração do arquivo local.

Desta forma, os dados ficam em dois lugares: **localmente no computador** e **diariamente na nuvem**.

### Verificando os backups

Periodicamente (sugestão: toda segunda-feira), confirme que os arquivos de backup estão sendo gerados:
1. Abra a pasta de backups (o suporte informa o caminho).
2. Confirme que há um arquivo com data de hoje ou ontem.
3. Se não houver, acione o suporte imediatamente.

### Restauração de backup

Em caso de problema (formatação, pane no sistema):
1. Reinstale o Docker e o sistema seguindo o guia do mantenedor.
2. Informe ao suporte o arquivo de backup mais recente.
3. O suporte executa o restore e o sistema volta ao estado do backup.

> **Atenção:** Dados lançados após o último backup serão perdidos em caso de restore. Quanto mais frequente o backup, menor o risco de perda.

---

## Apêndice — Referência Rápida

### Status dos títulos

| Status | Significado |
|--------|-------------|
| **Em aberto** | Título pendente, dentro do prazo |
| **Vencido** | Título pendente, prazo expirado |
| **Pago** | Pagamento confirmado |
| **Cancelado** | Título descartado |
| **Enviado** | Fatura enviada ao cliente, aguardando pagamento |

### CFOPs utilizados na Tapajós

| CFOP | Quando usar |
|------|------------|
| **5124 / 6124** | Industrialização para terceiros (serviço + insumos) — operação mais comum |
| **5101 / 6101** | Venda de produto industrializado |
| **5902 / 6902** | Retorno do material do cliente — não gera cobrança |

> **Dica:** 5xxx = operação dentro do estado de SP. 6xxx = operação para outro estado. O sistema preenche automaticamente com base no cadastro do produto e na UF do destinatário.

### Prazo de cobrança (billingTerms)

| Opção | Como funciona |
|-------|--------------|
| `dia15` | Acumula o mês inteiro em um recebível com vencimento no dia 15 do mês seguinte |
| `dia20` | Acumula o mês inteiro em um recebível com vencimento no dia 20 do mês seguinte |
| `7d` | Um recebível por NF, vence 7 dias após a emissão |
| `15d` | Um recebível por NF, vence 15 dias após a emissão |
| `28d` | Um recebível por NF, vence 28 dias após a emissão |
| `45d` | Um recebível por NF, vence 45 dias após a emissão |

---

*Documento gerado em março de 2026. Para dúvidas técnicas, consulte o Guia do Mantenedor ou acione o suporte.*

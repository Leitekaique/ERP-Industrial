/**
 * Configurações fixas do escritório / empresa emissora.
 * No deploy de produção, substitua OFFICE_EMAIL pelo endereço real do escritório.
 */
export const OFFICE_EMAIL = process.env.OFFICE_EMAIL ?? ''

/**
 * E-mail do escritório de contabilidade — recebe faturas, confirmações de pagamento
 * e e-mails de cobrança vencida. Distinto do OFFICE_EMAIL (que recebe NF-e e eventos).
 * Fallback para OFFICE_EMAIL quando não configurado.
 */
export const BILLING_EMAIL = process.env.BILLING_EMAIL ?? OFFICE_EMAIL

/**
 * Alíquotas IBPT usadas no texto de informações adicionais da NF-e.
 * Fonte: tabela IBPT vigente (federal + estadual combinados).
 */
export const IBPT_FEDERAL_PCT = 13.45
export const IBPT_ESTADUAL_PCT = 18.0

/**
 * CFOPs que representam retorno/devolução do material do cliente —
 * esses itens NÃO entram no valor de cobrança (billingAmount).
 * 5209/6209: devolução de compra para industrialização
 * 5902/6902: retorno de mercadoria para industrialização (com MO)
 * 5903/6903: retorno de mercadoria para industrialização sem cobrança (sem MO)
 */
export const NON_BILLING_CFOPS = ['5209', '6209', '5902', '6902', '5903', '6903', '5916', '6916', '5949', '6949', '5925', '6925']

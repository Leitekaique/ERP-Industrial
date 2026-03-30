/**
 * Configurações fixas do escritório / empresa emissora.
 * No deploy de produção, substitua OFFICE_EMAIL pelo endereço real do escritório.
 */
export const OFFICE_EMAIL = process.env.OFFICE_EMAIL ?? ''

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
 * 5902/6902: retorno de mercadoria para industrialização
 */
export const NON_BILLING_CFOPS = ['5209', '6209', '5902', '6902']

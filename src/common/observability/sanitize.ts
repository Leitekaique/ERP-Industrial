/**
 * Limpeza de textos antes de irem para o log em arquivo ou para o Sentry.
 *
 * Por quê: mensagens de erro às vezes carregam dados de clientes sem querer.
 * Exemplos reais:
 *  - o Prisma, em erro de validação, imprime o objeto inteiro da query
 *    (nome do cliente, valores, CNPJ...);
 *  - a SEFAZ devolve rejeições citando CNPJ/CPF.
 *
 * Então: mascaramos CNPJ/CPF, cortamos textos longos e trocamos as
 * mensagens do Prisma que costumam vazar dados por um resumo seguro.
 */

const MAX_LEN = 500

// CNPJ formatado (12.345.678/0001-90) ou CPF formatado (123.456.789-09)
const CNPJ_FMT = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g
const CPF_FMT = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g
// Sequências de 11 ou 14 dígitos (CPF/CNPJ sem pontuação).
// A chave de NF-e tem 44 dígitos e contém o CNPJ do emitente: também mascaramos.
const LONG_DIGITS = /\b\d{11,}\b/g

export function maskDocuments(text: string): string {
  return text
    .replace(CNPJ_FMT, '[CNPJ]')
    .replace(CPF_FMT, '[CPF]')
    .replace(LONG_DIGITS, (m) => (m.length === 44 ? '[CHAVE-NFE]' : `[${m.length}-DIGITOS]`))
}

export function truncate(text: string, max = MAX_LEN): string {
  return text.length > max ? `${text.slice(0, max)}… (+${text.length - max} chars)` : text
}

/**
 * Converte qualquer erro numa mensagem curta e segura para registrar.
 */
export function safeErrorMessage(err: unknown): string {
  if (!err) return 'erro desconhecido'
  const e = err as { name?: string; code?: string; message?: unknown }
  const name = e.name ?? 'Error'

  // Erros do Prisma: a mensagem pode trazer o "data" inteiro da query.
  // Guardamos só o tipo e o código (ex.: P2002 = violação de unique).
  if (name.startsWith('PrismaClient')) {
    return `${name}${e.code ? ` ${e.code}` : ''}`
  }

  const raw = typeof e.message === 'string' ? e.message : String(e.message ?? err)
  // Ex.: "Cannot GET /x?busca=NomeDoCliente" → "Cannot GET /x?…" (query string pode ter dados)
  const noQuery = raw.replace(/\?[^\s"']*/g, '?…')
  return truncate(maskDocuments(noQuery))
}

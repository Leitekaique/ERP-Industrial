/**
 * DTO para cancelamento de NF-e (modo simulador ou real)
 */
export class CancelNfeDto {
  /** Número da nota fiscal (nNF) */
  numeroNF!: string

  /** Justificativa do cancelamento */
  justificativa!: string
}

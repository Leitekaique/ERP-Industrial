/**
 * DTO principal para emissão de NF-e (modo simulador)
 * Estrutura completa, compatível com SEFAZ layout 4.00
 */
export class EmitNfeDto {
  /** Identificadores internos */
  tenantId!: string
  companyId!: string

  /** Dados do emitente (empresa Tapajós) */
  cnpjEmitente!: string
  razaoSocial!: string
  nomeFantasia?: string
  ie!: string
  endereco!: string
  numero?: string
  bairro?: string
  municipio!: string
  uf!: string
  cep?: string
  telefone?: string
  naturezaOperacao!: string
  crt?: string

  /** Número sequencial da NF (determinado pelo service antes de chamar buildXml) */
  nNF?: number
  /** Ambiente SEFAZ: '1'=produção, '2'=homologação */
  tpAmb?: '1' | '2'

  /** Dados do destinatário (cliente ou fornecedor) */
  cliente!: {
    nome: string
    cnpjCpf: string
    ie?: string
    email?: string
    endereco: string
    numero?: string
    bairro?: string
    municipio: string
    uf: string
    cep?: string
    telefone?: string
  }

  /** Itens da nota fiscal */
  itens!: {
    codigo: string
    descricao: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valorUnitario: number
    frete?: number
    impostos?: {
      icms?: {
        csosn?: string
        aliquota?: number
        valor?: number
      }
      ipi?: {
        cst?: string
      }
      pis?: {
        cst?: string
      }
      cofins?: {
        cst?: string
      }
    }
  }[]

  /** Totais gerais da NF-e */
  totalProdutos?: number
  totalFrete?: number
  totalImpostos?: number
  totalNFe?: number

  /** Informações de transporte */
  transporte?: {
    modFrete: number
    transportadora?: string
    cnpj?: string
    ie?: string
    endereco?: string
    municipio?: string
    uf?: string
    qVol?: number
    esp?: string
    pesoL?: number
    pesoB?: number
  }

  /** Informações de cobrança e duplicatas */
  cobranca?: {
    numeroFatura?: string
    valorOriginal?: number
    valorLiquido?: number
    duplicatas?: {
      numero: string
      vencimento: string
      valor: number
    }[]
  }

  /** Formas de pagamento */
  pagamento?: {
    formas: {
      tipo: string // 01=Dinheiro, 03=Crédito, 15=Boleto, 99=Outros
      descricao?: string
      valor: number
    }[]
  }

  /** Informações adicionais */
  informacoesAdicionais?: string
}

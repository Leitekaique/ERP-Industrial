// src/types/xml2js.d.ts
declare module 'xml2js' {
  // tipagem mínima suficiente p/ este serviço
  export function parseStringPromise(
    xml: string,
    options?: {
      explicitArray?: boolean
      tagNameProcessors?: Array<(name: string) => string>
      attrNameProcessors?: Array<(name: string) => string>
      valueProcessors?: Array<(value: string) => string>
      mergeAttrs?: boolean
      trim?: boolean
    }
  ): Promise<any>

  // a lib expõe 'processors' em runtime, mas as typings podem não exportar.
  // Mantemos “any” aqui para não quebrar seu build.
  export const processors: any
}

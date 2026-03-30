import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

// Uso: @Public() — marca a rota como pública (não exige JWT)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

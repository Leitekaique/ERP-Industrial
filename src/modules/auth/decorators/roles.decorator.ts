import { SetMetadata } from '@nestjs/common'
import { UserRole } from '@prisma/client'

export const ROLES_KEY = 'roles'

// Uso: @Roles(UserRole.ADMIN) — restringe a rota apenas para admins
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)

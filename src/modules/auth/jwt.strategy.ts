import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../database/prisma.service'

// Formato do payload que salvamos dentro do JWT ao fazer login
export interface JwtPayload {
  sub: string       // id do usuário
  email: string
  name: string
  role: string
  tenantId: string
  companyId: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      // Extrai o token do header: "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'tapajos-erp-secret-key',
    })
  }

  // Este método é chamado automaticamente após o Passport validar a assinatura do token.
  // O que retornamos aqui vai para req.user em todos os controllers.
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, tenantId: true, companyId: true, isActive: true },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou não encontrado')
    }

    return user
  }
}

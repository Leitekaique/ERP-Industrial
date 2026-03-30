import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../database/prisma.service'
import { CreateUserDto, LoginDto } from './dto/auth.dto'
import { JwtPayload } from './jwt.strategy'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ────────────────────────────────────────────────────
  // LOGIN
  // ────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })

    // Verificamos se o usuário existe E se a senha confere com o hash salvo
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email ou senha inválidos')
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash)
    if (!passwordOk) {
      throw new UnauthorizedException('Email ou senha inválidos')
    }

    return {
      accessToken: this.generateToken(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        companyId: user.companyId,
      },
    }
  }

  // ────────────────────────────────────────────────────
  // CRIAR USUÁRIO (apenas Admin pode chamar)
  // ────────────────────────────────────────────────────
  async createUser(dto: CreateUserDto, role: UserRole = UserRole.MANAGER) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('Email já cadastrado')

    // Nunca salvar senha em texto puro — bcrypt gera um hash seguro
    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        email: dto.email,
        passwordHash,
        name: dto.name,
        role,
      },
    })

    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }

  // ────────────────────────────────────────────────────
  // DADOS DO USUÁRIO ATUAL (/auth/me)
  // ────────────────────────────────────────────────────
  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, tenantId: true, companyId: true },
    })
  }

  // ────────────────────────────────────────────────────
  // PRIVADO — gera o JWT com os dados do usuário
  // ────────────────────────────────────────────────────
  private generateToken(user: { id: string; email: string; name: string; role: UserRole; tenantId: string; companyId: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      companyId: user.companyId,
    }
    return this.jwtService.sign(payload)
  }
}

import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { AuthService } from './auth.service'
import { Public } from './decorators/public.decorator'
import { Roles } from './decorators/roles.decorator'
import { CreateUserDto, LoginDto } from './dto/auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rota pública — não exige JWT (é aqui que o JWT é gerado)
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  // Retorna os dados do usuário logado — qualquer role autenticado
  @Get('me')
  me(@Req() req: any) {
    return this.authService.me(req.user.id)
  }

  // Cria um novo usuário — apenas Admin pode fazer isso
  @Post('users')
  @Roles(UserRole.ADMIN)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto)
  }
}

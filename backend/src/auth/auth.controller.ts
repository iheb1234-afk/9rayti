import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser } from '../common/roles';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

class LangDto {
  @IsIn(['fr', 'ar', 'en'])
  lang!: 'fr' | 'ar' | 'en';
}

@ApiTags('Comptes')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('me/lang')
  lang(@CurrentUser() user: AuthUser, @Body() dto: LangDto) {
    return this.auth.setLang(user.sub, dto.lang);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser } from '../common/roles';
import { AvatarDto, ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('me/password')
  @HttpCode(200)
  password(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('me/avatar')
  avatar(@CurrentUser() user: AuthUser, @Body() dto: AvatarDto) {
    return this.auth.setAvatar(user.sub, dto.dataUrl);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.auth.removeAvatar(user.sub);
  }
}

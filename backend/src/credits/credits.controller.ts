import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { CreditsService } from './credits.service';

class RechargeDto {
  /** Montant en dinars, de 5 à 200. */
  @IsNumber()
  @Min(5)
  @Max(200)
  amountDt!: number;
}

@ApiTags('Crédits')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('etudiant')
@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.credits.history(user.sub);
  }

  @Post('recharge')
  recharge(@CurrentUser() user: AuthUser, @Body() dto: RechargeDto) {
    return this.credits.recharge(user.sub, dto.amountDt);
  }
}

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { CatalogService } from './catalog.service';

class SearchQuery {
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minRating?: number;
  @IsOptional() @IsIn(['fr', 'ar', 'en']) lang?: string;
  @IsOptional() @IsIn(['semaine', 'soir', 'weekend']) when?: 'semaine' | 'soir' | 'weekend';
  @IsOptional() @IsIn(['pertinence', 'prix', 'note']) sort?: 'pertinence' | 'prix' | 'note';
}

class SlotDto {
  @Type(() => Date) @IsDate() startsAt!: Date;
  @IsInt() @Min(30) @Max(180) durationMin!: number;
}

class RateDto {
  @IsString() subjectCode!: string;
  @IsNumber() @Min(5) @Max(100) pricePerHourDt!: number;
}

@ApiTags('Catalogue')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('subjects')
  subjects() {
    return this.catalog.listSubjects();
  }

  @Get('tutors')
  @ApiQuery({ name: 'subject', required: false, example: 'probabilites' })
  search(@Query() q: SearchQuery) {
    return this.catalog.search(q);
  }

  @Get('tutors/:id')
  detail(@Param('id') id: string) {
    return this.catalog.detail(id);
  }
}

@ApiTags('Espace tuteur')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('tuteur')
@Controller('tutor')
export class TutorSpaceController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('slots')
  slots(@CurrentUser() user: AuthUser) {
    return this.catalog.mySlots(user.sub);
  }

  @Post('slots')
  addSlot(@CurrentUser() user: AuthUser, @Body() dto: SlotDto) {
    return this.catalog.addSlot(user.sub, dto.startsAt, dto.durationMin);
  }

  @Delete('slots/:id')
  removeSlot(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.removeSlot(user.sub, id);
  }

  @Put('rates')
  setRate(@CurrentUser() user: AuthUser, @Body() dto: RateDto) {
    return this.catalog.setRate(user.sub, dto.subjectCode, dto.pricePerHourDt);
  }
}

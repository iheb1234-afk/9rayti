import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { CreditsModule } from '../credits/credits.module';
import { ExamPlace, ExamSession } from './exam-session.entity';
import { ExamSessionsService } from './exam-sessions.service';

class CreateSessionDto {
  @IsString() subjectCode!: string;
  @Type(() => Date) @IsDate() startsAt!: Date;
  @IsInt() @Min(60) @Max(240) durationMin!: number;
  @IsInt() @Min(2) @Max(30) placesMin!: number;
  @IsInt() @Min(2) @Max(30) placesMax!: number;
  @IsNumber() @Min(5) @Max(60) pricePerPlaceDt!: number;
  @IsOptional() @IsString() @Length(0, 600) description?: string;
}

@ApiTags('Sessions d’examen')
@Controller('exam-sessions')
export class ExamSessionsController {
  constructor(private readonly sessions: ExamSessionsService) {}

  @Get()
  list(@Query('subject') subject?: string) {
    return this.sessions.list(subject);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Roles('etudiant')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.sessions.list(undefined, user.sub);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.detail(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(':id/me')
  detailForMe(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.detail(id, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Roles('etudiant')
  @Post(':id/book')
  book(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.book(user.sub, id);
  }
}

@ApiTags('Espace tuteur')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('tuteur')
@Controller('tutor/exam-sessions')
export class TutorExamSessionsController {
  constructor(private readonly sessions: ExamSessionsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.sessions.mine(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.sub, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ExamSession, ExamPlace, TutorProfile, Subject]), CreditsModule],
  controllers: [ExamSessionsController, TutorExamSessionsController],
  providers: [ExamSessionsService],
})
export class ExamSessionsModule {}

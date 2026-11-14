import { Controller, Get, Module, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { CreditsModule } from '../credits/credits.module';
import { ExamPlace, ExamSession } from './exam-session.entity';
import { ExamSessionsService } from './exam-sessions.service';

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

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Roles('etudiant')
  @Post(':id/book')
  book(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.book(user.sub, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ExamSession, ExamPlace]), CreditsModule],
  controllers: [ExamSessionsController],
  providers: [ExamSessionsService],
})
export class ExamSessionsModule {}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Length, Max, Min } from 'class-validator';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { RequestsService } from './requests.service';

class CreateRequestDto {
  @IsUUID() tutorId!: string;
  @IsString() subjectCode!: string;
  @IsInt() slotId!: number;
  @IsIn(['credits', 'carte']) payWith!: 'credits' | 'carte';
  /** Nom du cours joint en PDF (le fichier lui-même est déposé dans la salle de cours). */
  @IsOptional() @IsString() @Length(0, 120) attachmentName?: string;
  @IsOptional() @IsString() @Length(0, 500) message?: string;
}

class ReportDto {
  @IsString() @Length(5, 500) reason!: string;
}

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @Length(0, 500) comment?: string;
}

class CompleteDto {
  /** Compte rendu facultatif : ce qui a été vu, ce qu'il reste à travailler. */
  @IsOptional() @IsString() @Length(0, 1000) recap?: string;
}

class DocumentDto {
  @IsIn(['pdf', 'replay']) kind!: 'pdf' | 'replay';
  @IsString() @Length(2, 120) name!: string;
  @IsUrl({ require_tld: false }) url!: string;
}

@ApiTags('Demandes de cours')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  // ----- Étudiant

  @Roles('etudiant')
  @Post('requests')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.requests.create(user.sub, dto);
  }

  @Roles('etudiant')
  @Get('requests/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.requests.forStudent(user.sub);
  }

  @Roles('etudiant')
  @HttpCode(200)
  @Post('requests/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.cancel(user.sub, id);
  }

  @Roles('etudiant')
  @HttpCode(200)
  @Post('requests/:id/report')
  report(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDto) {
    return this.requests.report(user.sub, id, dto.reason);
  }

  @Roles('etudiant')
  @Post('requests/:id/review')
  review(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.requests.review(user.sub, id, dto.rating, dto.comment ?? '');
  }

  // ----- Tuteur

  @Roles('tuteur')
  @Get('tutor/requests')
  received(@CurrentUser() user: AuthUser) {
    return this.requests.forTutor(user.sub);
  }

  @Roles('tuteur')
  @Get('tutor/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.requests.tutorDashboard(user.sub);
  }

  @Roles('tuteur')
  @Get('tutor/revenue')
  revenue(@CurrentUser() user: AuthUser) {
    return this.requests.revenue(user.sub);
  }

  @Roles('tuteur')
  @HttpCode(200)
  @Post('requests/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.accept(user.sub, id);
  }

  @Roles('tuteur')
  @HttpCode(200)
  @Post('requests/:id/refuse')
  refuse(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.refuse(user.sub, id);
  }

  @Roles('tuteur')
  @HttpCode(200)
  @Post('requests/:id/tutor-cancel')
  tutorCancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.cancelByTutor(user.sub, id);
  }

  @Roles('tuteur')
  @HttpCode(200)
  @Post('requests/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteDto) {
    return this.requests.complete(user.sub, id, dto.recap);
  }

  // ----- Salle de cours (les deux participants)

  @Get('classroom/:id')
  classroom(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.classroom(user.sub, id);
  }

  @Roles('tuteur')
  @Post('classroom/:id/documents')
  addDocument(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentDto) {
    return this.requests.addDocument(user.sub, id, dto);
  }
}

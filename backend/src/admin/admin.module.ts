import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Rate } from '../catalog/rate.entity';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { AuthGuard, Roles } from '../common/roles';
import { ContactMessage, ContactModule } from '../contact/contact.module';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestsModule } from '../requests/requests.module';
import { RequestsService } from '../requests/requests.service';

class ResolveDto {
  @IsIn(['rembourser', 'verser']) decision!: 'rembourser' | 'verser';
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

class SubjectDto {
  @IsString() @Matches(/^[a-z0-9-]{2,40}$/, { message: 'Code : minuscules, chiffres et tirets' }) code!: string;
  @IsString() @Length(2, 60) nameFr!: string;
  @IsString() @Length(2, 60) nameAr!: string;
  @IsString() @Length(2, 60) nameEn!: string;
}

class SubjectPatchDto {
  @IsOptional() @IsString() @Length(2, 60) nameFr?: string;
  @IsOptional() @IsString() @Length(2, 60) nameAr?: string;
  @IsOptional() @IsString() @Length(2, 60) nameEn?: string;
}

class RequestsQuery {
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() @Length(0, 60) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

class ContactPatchDto {
  @IsIn(['nouveau', 'traite']) status!: 'nouveau' | 'traite';
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(Rate) private readonly rates: Repository<Rate>,
    @InjectRepository(ContactMessage) private readonly contacts: Repository<ContactMessage>,
    private readonly requests: RequestsService,
    private readonly notifications: NotificationsService,
  ) {}

  async pendingTutors() {
    const list = await this.tutors.find({ where: { status: 'en_attente' }, relations: { user: true, rates: true } });
    return list.map((t) => ({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      email: t.user.email,
      school: t.user.school,
      year: t.user.year,
      declaredAverage: t.declaredAverage,
      subjects: t.rates.map((r) => r.subject.nameFr),
      createdAt: t.user.createdAt,
    }));
  }

  /** Valide le tuteur, une seule fois. Le relevé de notes n'est jamais stocké : seul le badge « vérifié » reste. */
  async validate(id: string) {
    const t = await this.tutors.findOne({ where: { id }, relations: { user: true } });
    if (!t) throw new NotFoundException('Tuteur introuvable');
    t.status = 'valide';
    await this.tutors.save(t);
    await this.notifications.notify(null, t.user.id, 'tuteur_valide', { from: '9rayti' }, '/espace-tuteur');
    return { id, status: t.status };
  }

  async overview() {
    const [validated, pending, reports, contacts] = await Promise.all([
      this.tutors.countBy({ status: 'valide' }),
      this.tutors.countBy({ status: 'en_attente' }),
      this.requests.reports().then((r) => r.length),
      this.contacts.countBy({ status: 'nouveau' }),
    ]);
    return { tutors: { validated, pending }, reports, contacts, requests: await this.requests.countByState() };
  }

  /** Matières avec le nombre de tuteurs qui les enseignent. */
  async listSubjects() {
    const [subjects, counts] = await Promise.all([
      this.subjects.find({ order: { nameFr: 'ASC' } }),
      this.rates
        .createQueryBuilder('r')
        .select('r.subjectId', 'subjectId')
        .addSelect('COUNT(*)', 'n')
        .groupBy('r.subjectId')
        .getRawMany<{ subjectId: number; n: string }>(),
    ]);
    return subjects.map((s) => ({ ...s, tutors: Number(counts.find((c) => Number(c.subjectId) === s.id)?.n ?? 0) }));
  }

  async addSubject(dto: SubjectDto) {
    if (await this.subjects.existsBy({ code: dto.code })) throw new ConflictException('Ce code de matière existe déjà');
    return this.subjects.save(this.subjects.create(dto));
  }

  async updateSubject(id: number, dto: SubjectPatchDto) {
    const s = await this.subjects.findOneBy({ id });
    if (!s) throw new NotFoundException('Matière introuvable');
    Object.assign(s, dto);
    return this.subjects.save(s);
  }

  contactMessages() {
    return this.contacts.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  async setContactStatus(id: number, status: 'nouveau' | 'traite') {
    await this.contacts.update(id, { status });
    return this.contactMessages();
  }
}

@ApiTags('Administration')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly requests: RequestsService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('tutors/pending')
  pending() {
    return this.admin.pendingTutors();
  }

  @Post('tutors/:id/validate')
  validate(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.validate(id);
  }

  // Signalements
  @Get('reports')
  reports() {
    return this.requests.reports();
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDto) {
    return this.requests.resolveReport(id, dto.decision, dto.note);
  }

  // Cours et paiements
  @Get('requests')
  list(@Query() q: RequestsQuery) {
    return this.requests.adminList(q);
  }

  // Matières
  @Get('subjects')
  subjects() {
    return this.admin.listSubjects();
  }

  @Post('subjects')
  addSubject(@Body() dto: SubjectDto) {
    return this.admin.addSubject(dto);
  }

  @Patch('subjects/:id')
  updateSubject(@Param('id', ParseIntPipe) id: number, @Body() dto: SubjectPatchDto) {
    return this.admin.updateSubject(id, dto);
  }

  // Messages de la page Contact
  @Get('contact')
  contact() {
    return this.admin.contactMessages();
  }

  @Patch('contact/:id')
  setContact(@Param('id', ParseIntPipe) id: number, @Body() dto: ContactPatchDto) {
    return this.admin.setContactStatus(id, dto.status);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([TutorProfile, Subject, Rate]), RequestsModule, ContactModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

import { Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { AuthGuard, Roles } from '../common/roles';
import { RequestsModule } from '../requests/requests.module';
import { RequestsService } from '../requests/requests.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    private readonly requests: RequestsService,
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

  /** Valide le tuteur. Le relevé de notes n'est jamais stocké : seul le badge « vérifié » reste. */
  async validate(id: string) {
    const t = await this.tutors.findOneBy({ id });
    if (!t) throw new NotFoundException('Tuteur introuvable');
    t.status = 'valide';
    await this.tutors.save(t);
    return { id, status: t.status };
  }

  async overview() {
    const [validated, pending] = await Promise.all([
      this.tutors.countBy({ status: 'valide' }),
      this.tutors.countBy({ status: 'en_attente' }),
    ]);
    return { tutors: { validated, pending }, requests: await this.requests.countByState() };
  }
}

@ApiTags('Administration')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
}

@Module({
  imports: [TypeOrmModule.forFeature([TutorProfile]), RequestsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

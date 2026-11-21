import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { Favorite } from './favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    private readonly catalog: CatalogService,
  ) {}

  /** Cartes des tuteurs favoris, du plus récent au plus ancien. */
  async list(studentId: string) {
    const favs = await this.favorites.find({
      where: { student: { id: studentId } },
      relations: { tutor: { user: true, rates: { subject: true }, slots: true } },
      order: { createdAt: 'DESC' },
    });
    return favs.filter((f) => f.tutor.status === 'valide').map((f) => this.catalog.card(f.tutor));
  }

  async add(studentId: string, tutorId: string) {
    if (!(await this.tutors.existsBy({ id: tutorId, status: 'valide' })))
      throw new NotFoundException('Tuteur introuvable');
    await this.favorites.upsert(
      { student: { id: studentId }, tutor: { id: tutorId } },
      { conflictPaths: ['student', 'tutor'], skipUpdateIfNoValuesChanged: true },
    );
    return this.ids(studentId);
  }

  async remove(studentId: string, tutorId: string) {
    await this.favorites.delete({ student: { id: studentId }, tutor: { id: tutorId } });
    return this.ids(studentId);
  }

  async ids(studentId: string) {
    const favs = await this.favorites.find({ where: { student: { id: studentId } }, relations: { tutor: true } });
    return favs.map((f) => f.tutor.id);
  }
}

@ApiTags('Favoris')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('etudiant')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.favorites.list(user.sub);
  }

  @Get('ids')
  ids(@CurrentUser() user: AuthUser) {
    return this.favorites.ids(user.sub);
  }

  @Put(':tutorId')
  add(@CurrentUser() user: AuthUser, @Param('tutorId', ParseUUIDPipe) tutorId: string) {
    return this.favorites.add(user.sub, tutorId);
  }

  @Delete(':tutorId')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('tutorId', ParseUUIDPipe) tutorId: string) {
    return this.favorites.remove(user.sub, tutorId);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, TutorProfile]), CatalogModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}

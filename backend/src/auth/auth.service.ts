import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { Rate } from '../catalog/rate.entity';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { CreditsService } from '../credits/credits.service';
import { avatarUrl } from '../users/avatar-url';
import { ProfilePhoto } from '../users/profile-photo.entity';
import { User } from '../users/user.entity';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    school: user.school,
    year: user.year,
    lang: user.lang,
    tutorStatus: user.tutorProfile?.status ?? null,
    tutorProfileId: user.tutorProfile?.id ?? null,
    avatarUrl: avatarUrl(user),
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    private readonly jwt: JwtService,
    private readonly credits: CreditsService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.exists({ where: { email } })) {
      throw new ConflictException('Cette adresse a déjà un compte. Connecte-toi, ou utilise une autre adresse.');
    }
    const user = await this.users.manager.transaction(async (m) => {
      const created = await m.getRepository(User).save(
        m.getRepository(User).create({
          email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: dto.role,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          school: dto.school.trim(),
          year: dto.year.trim(),
          lang: dto.lang ?? 'fr',
        }),
      );
      if (dto.role === 'tuteur') {
        const profile = await m.getRepository(TutorProfile).save(
          m.getRepository(TutorProfile).create({
            user: created,
            bio: dto.bio ?? '',
            declaredAverage: dto.declaredAverage ?? null,
            status: 'en_attente',
            languages: [dto.lang ?? 'fr'],
          }),
        );
        const wanted = dto.subjects ?? [];
        if (wanted.length) {
          const found = await m.getRepository(Subject).find({ where: { code: In(wanted.map((s) => s.code)) } });
          await m.getRepository(Rate).save(
            found.map((subject) =>
              m.getRepository(Rate).create({
                tutor: profile,
                subject,
                pricePerHourMillimes: Math.round(wanted.find((w) => w.code === subject.code)!.pricePerHourDt * 1000),
              }),
            ),
          );
        }
      }
      return created;
    });
    return this.session(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    return this.session(user.id);
  }

  async me(userId: string) {
    const user = await this.users.findOneOrFail({ where: { id: userId }, relations: { tutorProfile: true } });
    const balanceMillimes = user.role === 'etudiant' ? await this.credits.balance(user.id) : 0;
    return { ...publicUser(user), balanceMillimes };
  }

  async setLang(userId: string, lang: 'fr' | 'ar' | 'en') {
    await this.users.update(userId, { lang });
    return this.me(userId);
  }

  /** Mettre à jour son nom, son école ou son année. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const patch: Partial<User> = {};
    for (const k of ['firstName', 'lastName', 'school', 'year'] as const) {
      if (dto[k] !== undefined) patch[k] = dto[k].trim();
    }
    if (Object.keys(patch).length) await this.users.update(userId, patch);
    return this.me(userId);
  }

  /** Changer de mot de passe : l'ancien est exigé, pour qu'un ordinateur resté ouvert ne suffise pas. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findOneOrFail({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Le mot de passe actuel est incorrect');
    }
    await this.users.update(userId, { passwordHash: await bcrypt.hash(dto.newPassword, 10) });
    return { ok: true };
  }

  /** Nouvelle photo de profil (déjà redimensionnée par le navigateur). */
  async setAvatar(userId: string, dataUrl: string) {
    const [, mime, b64] = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl) ?? [];
    const data = Buffer.from(b64 ?? '', 'base64');
    if (!mime || data.length < 100 || data.length > 300_000)
      throw new BadRequestException('Image invalide ou trop lourde');
    await this.users.manager.transaction(async (m) => {
      await m.getRepository(ProfilePhoto).save({ userId, mime, data });
      await m.getRepository(User).increment({ id: userId }, 'avatarVersion', 1);
    });
    return this.me(userId);
  }

  async removeAvatar(userId: string) {
    await this.users.manager.transaction(async (m) => {
      await m.getRepository(ProfilePhoto).delete({ userId });
      await m.getRepository(User).update(userId, { avatarVersion: 0 });
    });
    return this.me(userId);
  }

  private async session(userId: string) {
    const me = await this.me(userId);
    const token = await this.jwt.signAsync({ sub: me.id, role: me.role });
    return { token, user: me };
  }
}

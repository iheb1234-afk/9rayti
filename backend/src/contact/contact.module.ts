import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Body, Controller, HttpException, Injectable, Module, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsEmail, IsIn, IsString, Length } from 'class-validator';
import { MoreThan, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

/** Message envoyé depuis la page Contact (sitemap : « À propos, contact, CGU »). */
@Entity('message_contact')
export class ContactMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 80 })
  name!: string;

  @Column({ length: 120 })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  topic!: 'question' | 'tuteur' | 'probleme' | 'partenariat';

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 10, default: 'nouveau' })
  status!: 'nouveau' | 'traite';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

export class ContactDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEmail({}, { message: 'Adresse e-mail invalide' }) email!: string;
  @IsIn(['question', 'tuteur', 'probleme', 'partenariat']) topic!: ContactMessage['topic'];
  @IsString() @Length(10, 2000, { message: 'Ton message doit faire au moins 10 caractères' }) message!: string;
}

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage) private readonly messages: Repository<ContactMessage>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: ContactDto) {
    // Anti-abus simple : pas plus de 3 messages en 10 minutes pour une même adresse.
    const recent = await this.messages.count({
      where: { email: dto.email.toLowerCase(), createdAt: MoreThan(new Date(Date.now() - 600_000)) },
    });
    if (recent >= 3) throw new HttpException('Tu nous as déjà écrit plusieurs fois, on te répond vite !', 429);
    const saved = await this.messages.save(
      this.messages.create({ ...dto, email: dto.email.toLowerCase(), name: dto.name.trim() }),
    );
    await this.notifications.notifyAdmins(
      null,
      'contact',
      { from: saved.name, topic: saved.topic },
      '/admin?onglet=contact',
    );
    return { ok: true, id: saved.id };
  }
}

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  send(@Body() dto: ContactDto) {
    return this.contact.create(dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage])],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [TypeOrmModule],
})
export class ContactModule {}

import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import type { AuthUser } from '../common/roles';
import { NotificationsService } from '../notifications/notifications.service';
import { CourseRequest } from '../requests/course-request.entity';
import { avatarUrl } from '../users/avatar-url';
import { User } from '../users/user.entity';
import { maskContactInfo } from './contact-masking';
import { Message } from './message.entity';

const MAX_PER_HOUR = 60;

/**
 * Conversations étudiant ↔ tuteur. Pour un étudiant, l'interlocuteur est un profil tuteur ;
 * pour un tuteur, c'est un compte étudiant. Les coordonnées sont masquées à l'envoi.
 */
@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CourseRequest) private readonly requests: Repository<CourseRequest>,
    private readonly notifications: NotificationsService,
  ) {}

  private view(m: Message, me: AuthUser) {
    return {
      id: m.id,
      body: m.body,
      masked: m.masked,
      mine: m.fromRole === me.role,
      readAt: m.readAt,
      createdAt: m.createdAt,
    };
  }

  private async tutorProfileOf(userId: string) {
    const t = await this.tutors.findOne({ where: { user: { id: userId } } });
    if (!t) throw new NotFoundException('Profil tuteur introuvable');
    return t;
  }

  /** Liste des conversations, la plus récente en premier, avec le nombre de messages non lus. */
  async threads(me: AuthUser) {
    const tutor = me.role === 'tuteur' ? await this.tutorProfileOf(me.sub) : null;
    const where = tutor ? { tutor: { id: tutor.id } } : { student: { id: me.sub } };
    const all = await this.messages.find({
      where,
      relations: { student: true, tutor: { user: true } },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const threads = new Map<string, ReturnType<MessagesService['threadView']>>();
    for (const m of all) {
      const key = tutor ? m.student.id : m.tutor.id;
      if (!threads.has(key)) threads.set(key, this.threadView(m, me));
      if (m.fromRole !== me.role && !m.readAt) threads.get(key)!.unread++;
    }
    return [...threads.values()];
  }

  private threadView(last: Message, me: AuthUser) {
    const partner =
      me.role === 'tuteur'
        ? {
            id: last.student.id,
            name: last.student.firstName,
            school: last.student.school,
            avatarUrl: avatarUrl(last.student),
          }
        : {
            id: last.tutor.id,
            name: `${last.tutor.user.firstName} ${last.tutor.user.lastName.charAt(0)}.`,
            school: last.tutor.user.school,
            avatarUrl: avatarUrl(last.tutor.user),
          };
    return { partner, last: this.view(last, me), unread: 0 };
  }

  /** Une conversation ; les messages reçus sont marqués comme lus. */
  async thread(me: AuthUser, partnerId: string) {
    const { studentId, tutor, partner } = await this.pair(me, partnerId);
    const list = await this.messages.find({
      where: { student: { id: studentId }, tutor: { id: tutor.id } },
      order: { createdAt: 'ASC' },
      take: 300,
    });
    await this.messages.update(
      {
        student: { id: studentId },
        tutor: { id: tutor.id },
        fromRole: Not(me.role as 'etudiant' | 'tuteur'),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
    const canWrite = await this.canWrite(me, studentId, tutor);
    return { partner, canWrite, messages: list.map((m) => this.view(m, me)) };
  }

  async send(me: AuthUser, partnerId: string, rawBody: string) {
    const body = rawBody.trim();
    if (!body) throw new BadRequestException('Message vide');
    const { studentId, tutor } = await this.pair(me, partnerId);
    if (!(await this.canWrite(me, studentId, tutor))) {
      throw new ForbiddenException('Le tuteur peut répondre, mais ne peut pas écrire en premier à un étudiant');
    }
    const lastHour = await this.messages.count({
      where: {
        student: { id: studentId },
        tutor: { id: tutor.id },
        fromRole: me.role as 'etudiant' | 'tuteur',
        createdAt: MoreThan(new Date(Date.now() - 3_600_000)),
      },
    });
    if (lastHour >= MAX_PER_HOUR) throw new HttpException('Trop de messages en une heure, réessaie plus tard', 429);

    const { text, masked } = maskContactInfo(body);
    const saved = await this.messages.save(
      this.messages.create({
        student: { id: studentId },
        tutor: { id: tutor.id },
        fromRole: me.role as 'etudiant' | 'tuteur',
        body: text,
        masked,
      }),
    );
    const sender = await this.users.findOneByOrFail({ id: me.sub });
    const recipientId = me.role === 'tuteur' ? studentId : tutor.user.id;
    // Côté destinataire, l'interlocuteur est l'expéditeur : profil tuteur ou compte étudiant.
    const recipientPartnerId = me.role === 'tuteur' ? tutor.id : studentId;
    this.notifications.push(recipientId, 'message', {
      partnerId: recipientPartnerId,
      message: { ...this.view(saved, me), mine: false },
    });
    await this.notifications.notify(
      null,
      recipientId,
      'message',
      { from: sender.firstName },
      `/messages/${recipientPartnerId}`,
    );
    return this.view(saved, me);
  }

  /**
   * Un étudiant peut écrire à tout tuteur validé (questions avant de réserver).
   * Un tuteur répond à une conversation existante ou à un étudiant qui lui a envoyé une demande.
   */
  private async canWrite(me: AuthUser, studentId: string, tutor: TutorProfile) {
    if (me.role === 'etudiant') return tutor.status === 'valide';
    const started = await this.messages.exists({
      where: { student: { id: studentId }, tutor: { id: tutor.id }, fromRole: 'etudiant' },
    });
    return started || (await this.requests.exists({ where: { student: { id: studentId }, tutor: { id: tutor.id } } }));
  }

  private async pair(me: AuthUser, partnerId: string) {
    if (me.role === 'etudiant') {
      const tutor = await this.tutors.findOne({ where: { id: partnerId }, relations: { user: true } });
      if (!tutor) throw new NotFoundException('Tuteur introuvable');
      return {
        studentId: me.sub,
        tutor,
        partner: {
          id: tutor.id,
          name: `${tutor.user.firstName} ${tutor.user.lastName.charAt(0)}.`,
          school: tutor.user.school,
          avatarUrl: avatarUrl(tutor.user),
          role: 'tuteur' as const,
        },
      };
    }
    if (me.role !== 'tuteur') throw new ForbiddenException('Messagerie réservée aux étudiants et aux tuteurs');
    const tutor = await this.tutors.findOne({ where: { user: { id: me.sub } }, relations: { user: true } });
    if (!tutor) throw new NotFoundException('Profil tuteur introuvable');
    const student = await this.users.findOneBy({ id: partnerId, role: 'etudiant' });
    if (!student) throw new NotFoundException('Étudiant introuvable');
    return {
      studentId: student.id,
      tutor,
      partner: {
        id: student.id,
        name: student.firstName,
        school: student.school,
        avatarUrl: avatarUrl(student),
        role: 'etudiant' as const,
      },
    };
  }
}

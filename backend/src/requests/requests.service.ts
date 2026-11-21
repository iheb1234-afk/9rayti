import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { EntityManager, In, LessThanOrEqual, Repository } from 'typeorm';
import { Rate } from '../catalog/rate.entity';
import { Slot } from '../catalog/slot.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { BOOKING_FEE_MILLIMES, REPORT_WINDOW_MS, RESPONSE_DELAY_MS, lessonPrice } from '../common/money';
import { CreditsService } from '../credits/credits.service';
import { NotificationType } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { avatarUrl } from '../users/avatar-url';
import { CourseDocument } from './course-document.entity';
import { CourseRequest } from './course-request.entity';
import {
  CLASSROOM_STATES,
  REFUND_STATES,
  RequestAction,
  TransitionError,
  isExpired,
  isPayoutDue,
  nextState,
  publicRating,
  responseRate,
} from './request-state';
import { Review } from './review.entity';

export interface CreateRequestInput {
  tutorId: string;
  subjectCode: string;
  slotId: number;
  payWith: 'credits' | 'carte';
  attachmentName?: string;
  message?: string;
}

@Injectable()
export class RequestsService {
  private readonly log = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(CourseRequest) private readonly requests: Repository<CourseRequest>,
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    private readonly credits: CreditsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- vue

  view(r: CourseRequest) {
    return {
      id: r.id,
      state: r.state,
      subject: r.subject,
      startsAt: r.startsAt,
      durationMin: r.durationMin,
      amountMillimes: r.amountMillimes,
      feeMillimes: r.feeMillimes,
      totalMillimes: r.amountMillimes + r.feeMillimes,
      payWith: r.payWith,
      attachmentName: r.attachmentName,
      message: r.message,
      expiresAt: r.expiresAt,
      answeredAt: r.answeredAt,
      doneAt: r.doneAt,
      payoutAt: r.payoutAt,
      reportReason: r.reportReason,
      resolutionNote: r.resolutionNote,
      recap: r.recap,
      createdAt: r.createdAt,
      student: {
        id: r.student.id,
        firstName: r.student.firstName,
        school: r.student.school,
        avatarUrl: avatarUrl(r.student),
      },
      tutor: {
        id: r.tutor.id,
        firstName: r.tutor.user?.firstName ?? '',
        lastInitial: r.tutor.user ? `${r.tutor.user.lastName.charAt(0)}.` : '',
        avatarUrl: avatarUrl(r.tutor.user),
      },
      review: r.review ? { rating: r.review.rating, comment: r.review.comment } : null,
      canReview: ['faite', 'versee', 'signalee'].includes(r.state) && !r.review,
      canReport: r.state === 'faite' && r.payoutAt !== null && r.payoutAt.getTime() > Date.now(),
    };
  }

  private readonly relations = { tutor: { user: true }, review: true } as const;

  // ---------------------------------------------------------------- création

  /**
   * Envoie une demande. Tout se fait dans une transaction, avec l'heure verrouillée :
   * deux étudiants ne peuvent pas obtenir le même créneau, et l'argent n'est débité qu'une fois.
   */
  async create(studentId: string, input: CreateRequestInput) {
    const id = await this.requests.manager.transaction(async (m) => {
      const slot = await m
        .getRepository(Slot)
        .createQueryBuilder('s')
        .innerJoinAndSelect('s.tutor', 't')
        .where('s.id = :id', { id: input.slotId })
        .setLock('pessimistic_write', undefined, ['s'])
        .getOne();
      if (!slot || slot.tutor.id !== input.tutorId) throw new NotFoundException('Cette heure n’existe pas');
      if (slot.booked) throw new ConflictException('Cette heure vient d’être prise : choisis-en une autre');
      if (slot.startsAt.getTime() <= Date.now()) throw new BadRequestException('Cette heure est déjà passée');

      const tutor = await m.getRepository(TutorProfile).findOneOrFail({ where: { id: input.tutorId } });
      if (tutor.status !== 'valide') throw new BadRequestException('Ce tuteur n’est pas encore validé');

      const rate = await m.getRepository(Rate).findOne({
        where: { tutor: { id: tutor.id }, subject: { code: input.subjectCode } },
      });
      if (!rate) throw new BadRequestException('Ce tuteur n’enseigne pas cette matière');

      const amount = lessonPrice(rate.pricePerHourMillimes, slot.durationMin);
      const requestId = randomUUID();
      const label = `Cours de ${rate.subject.nameFr}`;
      if (input.payWith === 'credits') {
        await this.credits.debit(m, studentId, amount + BOOKING_FEE_MILLIMES, label, requestId);
      }

      slot.booked = true;
      await m.getRepository(Slot).save(slot);
      await m.getRepository(TutorProfile).increment({ id: tutor.id }, 'requestsReceived', 1);

      await m.getRepository(CourseRequest).insert({
        id: requestId,
        student: { id: studentId },
        tutor: { id: tutor.id },
        subject: { id: rate.subject.id },
        slot: { id: slot.id },
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        amountMillimes: amount,
        feeMillimes: BOOKING_FEE_MILLIMES,
        payWith: input.payWith,
        attachmentName: input.attachmentName?.trim() || null,
        message: input.message?.trim() ?? '',
        expiresAt: new Date(Date.now() + RESPONSE_DELAY_MS),
        jitsiRoom: `9rayti-${requestId.slice(0, 8)}-${randomUUID().slice(0, 4)}`,
        state: 'en_attente',
      });
      return requestId;
    });
    const created = await this.load(id);
    await this.notifications.notify(
      null,
      created.tutor.user.id,
      'demande_recue',
      this.params(created, created.student.firstName),
      '/espace-tuteur',
    );
    return this.view(created);
  }

  /** Paramètres communs des notifications : qui, et quelle matière (dans les trois langues). */
  private params(r: CourseRequest, from: string, more: Record<string, string | number> = {}) {
    return { from, subjectFr: r.subject.nameFr, subjectAr: r.subject.nameAr, subjectEn: r.subject.nameEn, ...more };
  }

  /** Qui prévenir après une transition, et vers quelle page l'envoyer. */
  private async notifyTransition(m: EntityManager, r: CourseRequest, from: string) {
    const tutorName = `${r.tutor.user.firstName} ${r.tutor.user.lastName.charAt(0)}.`;
    const student = r.student.id;
    const tutor = r.tutor.user.id;
    const send = (
      userId: string,
      type: NotificationType,
      who: string,
      link: string,
      more: Record<string, string | number> = {},
    ) => this.notifications.notify(m, userId, type, this.params(r, who, more), link);
    switch (r.state) {
      case 'acceptee':
        return send(student, 'demande_acceptee', tutorName, `/salle/${r.id}`);
      case 'refusee':
        return send(student, 'demande_refusee', tutorName, '/mon-espace?onglet=credits');
      case 'expiree':
        return send(student, 'demande_expiree', tutorName, '/mon-espace?onglet=credits');
      case 'annulee':
        return send(tutor, 'cours_annule', r.student.firstName, '/espace-tuteur');
      case 'annulee_tuteur':
        return send(student, 'cours_annule', tutorName, '/mon-espace?onglet=credits');
      case 'faite':
        return send(student, 'cours_termine', tutorName, '/mon-espace');
      case 'signalee':
        await send(tutor, 'signalement', r.student.firstName, '/espace-tuteur?onglet=cours');
        return this.notifications.notifyAdmins(
          m,
          'signalement',
          this.params(r, r.student.firstName),
          '/admin?onglet=signalements',
        );
      case 'remboursee':
        await send(student, 'signalement_traite', tutorName, '/mon-espace?onglet=credits', { decision: 'rembourser' });
        return send(tutor, 'signalement_traite', r.student.firstName, '/espace-tuteur?onglet=revenus', {
          decision: 'rembourser',
        });
      case 'versee':
        if (from === 'signalee')
          await send(student, 'signalement_traite', tutorName, '/mon-espace', { decision: 'verser' });
        return send(tutor, 'versement', r.student.firstName, '/espace-tuteur?onglet=revenus', {
          amount: r.amountMillimes,
        });
    }
  }

  // ---------------------------------------------------------------- transitions

  private async load(id: string, m?: EntityManager) {
    const repo = m?.getRepository(CourseRequest) ?? this.requests;
    const r = await repo.findOne({ where: { id }, relations: this.relations });
    if (!r) throw new NotFoundException('Demande introuvable');
    return r;
  }

  /** Applique une transition après avoir vérifié qui la demande. */
  private async apply(
    id: string,
    action: RequestAction,
    actor: { userId: string; as: 'etudiant' | 'tuteur' | 'systeme' },
    extra?: (r: CourseRequest, m: EntityManager) => Promise<void> | void,
  ) {
    // Les demandes arrivées à échéance sont d'abord expirées (et remboursées) dans leur propre transaction.
    await this.sweep();
    await this.requests.manager.transaction(async (m) => {
      await m
        .getRepository(CourseRequest)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      const r = await this.load(id, m);
      if (actor.as === 'etudiant' && r.student.id !== actor.userId)
        throw new ForbiddenException('Ce n’est pas ta demande');
      if (actor.as === 'tuteur' && r.tutor.user.id !== actor.userId) {
        throw new ForbiddenException('Cette demande ne t’est pas adressée');
      }
      if (r.state === 'expiree') {
        throw new BadRequestException('La demande a expiré : l’étudiant a été remboursé en crédits');
      }
      try {
        await this.transition(m, r, action, extra);
      } catch (e) {
        if (e instanceof TransitionError) throw new BadRequestException(e.message);
        throw e;
      }
    });
    return this.view(await this.load(id));
  }

  private async transition(
    m: EntityManager,
    r: CourseRequest,
    action: RequestAction,
    extra?: (r: CourseRequest, m: EntityManager) => Promise<void> | void,
  ) {
    const from = r.state;
    r.state = nextState(action, from);
    if (from === 'en_attente' && (action === 'accepter' || action === 'refuser')) {
      r.answeredAt = new Date();
      await m.getRepository(TutorProfile).increment({ id: r.tutor.id }, 'requestsAnswered', 1);
    }
    if (REFUND_STATES.has(r.state)) {
      // Remboursement en crédits 9rayti, quel que soit le moyen de paiement (décision de l'objectif 2).
      await this.credits.record(
        m,
        r.student.id,
        r.amountMillimes + r.feeMillimes,
        'remboursement',
        `Remboursement : ${r.subject.nameFr} (${r.state.replace('_', ' ')})`,
        r.id,
      );
      if (r.slot) await m.getRepository(Slot).update(r.slot.id, { booked: false });
    }
    await extra?.(r, m);
    await m.getRepository(CourseRequest).save(r);
    await this.notifyTransition(m, r, from);
  }

  accept(tutorUserId: string, id: string) {
    return this.apply(id, 'accepter', { userId: tutorUserId, as: 'tuteur' });
  }

  refuse(tutorUserId: string, id: string) {
    return this.apply(id, 'refuser', { userId: tutorUserId, as: 'tuteur' });
  }

  cancel(studentId: string, id: string) {
    return this.apply(id, 'annuler', { userId: studentId, as: 'etudiant' });
  }

  cancelByTutor(tutorUserId: string, id: string) {
    return this.apply(id, 'annuler_tuteur', { userId: tutorUserId, as: 'tuteur' });
  }

  /** Le tuteur clôt la séance : le paiement est versé 24 h plus tard, sauf signalement. */
  complete(tutorUserId: string, id: string, recap?: string) {
    return this.apply(id, 'terminer', { userId: tutorUserId, as: 'tuteur' }, async (r, m) => {
      r.recap = recap?.trim() || null;
      r.doneAt = new Date();
      r.payoutAt = new Date(Date.now() + REPORT_WINDOW_MS);
      await m.getRepository(TutorProfile).increment({ id: r.tutor.id }, 'minutesTaught', r.durationMin);
    });
  }

  report(studentId: string, id: string, reason: string) {
    return this.apply(id, 'signaler', { userId: studentId, as: 'etudiant' }, (r) => {
      if (!r.payoutAt || r.payoutAt.getTime() <= Date.now()) {
        throw new BadRequestException('Le délai de 24 h pour signaler est dépassé');
      }
      r.reportReason = reason;
    });
  }

  async review(studentId: string, id: string, rating: number, comment: string) {
    await this.requests.manager.transaction(async (m) => {
      const r = await this.load(id, m);
      if (r.student.id !== studentId) throw new ForbiddenException('Ce n’est pas ta demande');
      if (!['faite', 'versee', 'signalee'].includes(r.state)) {
        throw new BadRequestException('Tu pourras noter le cours une fois qu’il aura eu lieu');
      }
      if (r.review) throw new ConflictException('Tu as déjà noté ce cours');
      await m.getRepository(Review).insert({ request: { id: r.id }, rating, comment: comment.trim() });
      await m.getRepository(TutorProfile).increment({ id: r.tutor.id }, 'ratingSum', rating);
      await m.getRepository(TutorProfile).increment({ id: r.tutor.id }, 'ratingCount', 1);
      await this.notifications.notify(
        m,
        r.tutor.user.id,
        'avis_recu',
        this.params(r, r.student.firstName, { rating }),
        `/tuteurs/${r.tutor.id}`,
      );
    });
    return this.view(await this.load(id));
  }

  // ---------------------------------------------------------------- administration

  /** Signalements en attente d'une décision. */
  async reports() {
    const list = await this.requests.find({
      where: { state: 'signalee' },
      relations: this.relations,
      order: { doneAt: 'ASC' },
    });
    return list.map((r) => this.view(r));
  }

  /** L'admin tranche : rembourser l'étudiant (crédits) ou verser le paiement au tuteur. */
  resolveReport(id: string, decision: 'rembourser' | 'verser', note?: string) {
    return this.apply(id, decision, { userId: '', as: 'systeme' }, (r) => {
      r.resolutionNote = note?.trim() || null;
    });
  }

  /** Tous les cours et paiements, filtrables par état ou par nom (page admin « Cours et paiements »). */
  async adminList(q: { state?: string; search?: string; page?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const qb = this.requests
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.student', 's')
      .leftJoinAndSelect('r.tutor', 't')
      .leftJoinAndSelect('t.user', 'tu')
      .leftJoinAndSelect('r.subject', 'sub')
      .leftJoinAndSelect('r.review', 'rev')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * 20)
      .take(20);
    if (q.state) qb.andWhere('r.state = :state', { state: q.state });
    if (q.search) {
      qb.andWhere('(s.firstName ILIKE :q OR tu.firstName ILIKE :q OR sub.nameFr ILIKE :q)', { q: `%${q.search}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    return { total, page, pages: Math.max(1, Math.ceil(total / 20)), items: items.map((r) => this.view(r)) };
  }

  // ---------------------------------------------------------------- revenus du tuteur

  /** Revenus des 12 dernières semaines (versés et en attente), pour le graphique de l'espace tuteur. */
  async revenue(tutorUserId: string) {
    const tutor = await this.tutors.findOne({ where: { user: { id: tutorUserId } } });
    if (!tutor) throw new NotFoundException('Profil tuteur introuvable');
    const list = await this.requests.find({
      where: { tutor: { id: tutor.id }, state: In(['faite', 'versee', 'signalee']) },
      relations: this.relations,
      order: { doneAt: 'DESC' },
    });
    const monday = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x;
    };
    const thisWeek = monday(new Date());
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(thisWeek);
      start.setDate(start.getDate() - (11 - i) * 7);
      return { weekStart: start.toISOString(), paidMillimes: 0, pendingMillimes: 0, courses: 0 };
    });
    for (const r of list) {
      const when = r.doneAt ?? r.startsAt;
      const idx = weeks.findIndex(
        (w, i) => when >= new Date(w.weekStart) && (i === 11 || when < new Date(weeks[i + 1].weekStart)),
      );
      if (idx < 0) continue;
      weeks[idx].courses++;
      if (r.state === 'versee') weeks[idx].paidMillimes += r.amountMillimes;
      else weeks[idx].pendingMillimes += r.amountMillimes;
    }
    const paid = list.filter((r) => r.state === 'versee');
    const pending = list.filter((r) => r.state !== 'versee');
    return {
      weeks,
      totalPaidMillimes: paid.reduce((s, r) => s + r.amountMillimes, 0),
      pendingMillimes: pending.reduce((s, r) => s + r.amountMillimes, 0),
      nextPayoutAt:
        pending
          .filter((r) => r.state === 'faite')
          .map((r) => r.payoutAt)
          .sort()[0] ?? null,
      payouts: list.slice(0, 30).map((r) => this.view(r)),
    };
  }

  // ---------------------------------------------------------------- listes

  async forStudent(studentId: string) {
    await this.sweep();
    const list = await this.requests.find({
      where: { student: { id: studentId } },
      relations: this.relations,
      order: { startsAt: 'ASC' },
    });
    return list.map((r) => this.view(r));
  }

  async forTutor(tutorUserId: string) {
    await this.sweep();
    const list = await this.requests.find({
      where: { tutor: { user: { id: tutorUserId } } },
      relations: this.relations,
      order: { expiresAt: 'ASC' },
    });
    return list.map((r) => this.view(r));
  }

  async tutorDashboard(tutorUserId: string) {
    const tutor = await this.tutors.findOne({ where: { user: { id: tutorUserId } }, relations: { user: true } });
    if (!tutor) throw new NotFoundException('Profil tuteur introuvable');
    const all = await this.forTutor(tutorUserId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paid = all.filter((r) => r.state === 'versee' && r.doneAt && new Date(r.doneAt) >= monthStart);
    const pending = all.filter((r) => r.state === 'faite');
    const upcoming = all
      .filter((r) => r.state === 'acceptee' && new Date(r.startsAt).getTime() > Date.now() - 2 * 3600 * 1000)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return {
      status: tutor.status,
      earnedThisMonthMillimes: paid.reduce((s, r) => s + r.amountMillimes, 0),
      pendingPayoutMillimes: pending.reduce((s, r) => s + r.amountMillimes, 0),
      responseRate: responseRate(tutor.requestsReceived, tutor.requestsAnswered),
      rating: publicRating(tutor.ratingSum, tutor.ratingCount),
      ratingCount: tutor.ratingCount,
      hoursTaught: Math.round(tutor.minutesTaught / 60),
      nextCourse: upcoming[0] ?? null,
      pendingRequests: all.filter((r) => r.state === 'en_attente').length,
    };
  }

  // ---------------------------------------------------------------- salle de cours

  async classroom(userId: string, id: string) {
    const r = await this.requests.findOne({
      where: { id },
      relations: { ...this.relations, documents: true },
    });
    if (!r) throw new NotFoundException('Cours introuvable');
    const isStudent = r.student.id === userId;
    const isTutor = r.tutor.user.id === userId;
    if (!isStudent && !isTutor) throw new ForbiddenException('Seuls les deux participants peuvent entrer');
    if (!CLASSROOM_STATES.has(r.state)) {
      throw new ForbiddenException('La salle ouvre quand le tuteur a accepté la demande');
    }
    return {
      ...this.view(r),
      role: isStudent ? 'etudiant' : 'tuteur',
      jitsiRoom: r.jitsiRoom,
      jitsiUrl: `https://meet.jit.si/${r.jitsiRoom}`,
      documents: (r.documents ?? [])
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((d) => ({ id: d.id, kind: d.kind, name: d.name, url: d.url, createdAt: d.createdAt })),
    };
  }

  async addDocument(tutorUserId: string, id: string, doc: { kind: 'pdf' | 'replay'; name: string; url: string }) {
    const r = await this.load(id);
    if (r.tutor.user.id !== tutorUserId) throw new ForbiddenException('Seul le tuteur du cours dépose des supports');
    if (!CLASSROOM_STATES.has(r.state)) throw new BadRequestException('Le cours n’a pas encore été accepté');
    await this.requests.manager.getRepository(CourseDocument).insert({ request: { id }, ...doc });
    return this.classroom(tutorUserId, id);
  }

  // ---------------------------------------------------------------- tâches automatiques

  /**
   * Toutes les minutes : les demandes sans réponse depuis 12 h expirent (et sont remboursées),
   * les cours faits depuis 24 h sans signalement sont versés au tuteur.
   * Aussi appelée avant chaque liste, pour que l'écran soit toujours juste.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    const now = new Date();
    const due = await this.requests.find({
      where: [
        { state: 'en_attente', expiresAt: LessThanOrEqual(now) },
        { state: 'faite', payoutAt: LessThanOrEqual(now) },
      ],
      select: { id: true },
    });
    for (const { id } of due) {
      await this.requests.manager.transaction(async (m) => {
        const r = await this.load(id, m);
        if (isExpired(r.state, r.expiresAt, now)) await this.transition(m, r, 'expirer');
        else if (isPayoutDue(r.state, r.payoutAt, now)) await this.transition(m, r, 'verser');
      });
    }
    if (due.length) this.log.log(`${due.length} demande(s) mises à jour automatiquement`);
  }

  async countByState() {
    const rows = await this.requests
      .createQueryBuilder('r')
      .select('r.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.amountMillimes + r.feeMillimes), 0)', 'volume')
      .groupBy('r.state')
      .getRawMany<{ state: string; count: string; volume: string }>();
    return rows.map((x) => ({ state: x.state, count: Number(x.count), volumeMillimes: Number(x.volume) }));
  }
}

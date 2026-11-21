import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { avatarUrl } from '../users/avatar-url';
import { ExamPlace, ExamSession } from './exam-session.entity';

export interface CreateSessionInput {
  subjectCode: string;
  startsAt: Date;
  durationMin: number;
  placesMin: number;
  placesMax: number;
  pricePerPlaceDt: number;
  description?: string;
}

/**
 * Sessions d'examen en groupe (Objectif 1) : un tuteur, plusieurs étudiants, un prix par place.
 * La session n'a lieu que si le minimum d'inscrits est atteint ; sinon chacun est remboursé.
 */
@Injectable()
export class ExamSessionsService {
  private readonly log = new Logger(ExamSessionsService.name);

  constructor(
    @InjectRepository(ExamSession) private readonly sessions: Repository<ExamSession>,
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    private readonly credits: CreditsService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly relations = { tutor: { user: true }, places: { student: true } } as const;

  private view(s: ExamSession, viewerId?: string, withStudents = false) {
    const taken = s.places?.length ?? 0;
    return {
      id: s.id,
      subject: s.subject,
      tutor: {
        id: s.tutor.id,
        firstName: s.tutor.user.firstName,
        lastInitial: `${s.tutor.user.lastName.charAt(0)}.`,
        school: s.tutor.user.school,
        avatarUrl: avatarUrl(s.tutor.user),
      },
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      placesMin: s.placesMin,
      placesMax: s.placesMax,
      placesTaken: taken,
      confirmed: taken >= s.placesMin,
      status: s.status,
      description: s.description,
      pricePerPlaceMillimes: s.pricePerPlaceMillimes,
      booked: viewerId ? (s.places ?? []).some((p) => p.student?.id === viewerId) : false,
      // Prénoms des inscrits : seulement pour le tuteur de la session.
      ...(withStudents
        ? { students: (s.places ?? []).map((p) => ({ firstName: p.student.firstName, school: p.student.school })) }
        : {}),
    };
  }

  async list(subject?: string, studentId?: string) {
    const list = await this.sessions.find({
      where: { startsAt: MoreThan(new Date()), status: 'ouverte', ...(subject ? { subject: { code: subject } } : {}) },
      relations: this.relations,
      order: { startsAt: 'ASC' },
    });
    return list.map((s) => this.view(s, studentId));
  }

  async detail(id: string, viewerId?: string) {
    const s = await this.sessions.findOne({ where: { id }, relations: this.relations });
    if (!s) throw new NotFoundException('Session introuvable');
    return this.view(s, viewerId, !!viewerId && s.tutor.user.id === viewerId);
  }

  /** Réserve une place : paiement en crédits, dans une transaction avec la session verrouillée. */
  async book(studentId: string, id: string) {
    const s = await this.sessions.manager.transaction(async (m) => {
      await m
        .getRepository(ExamSession)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id })
        .getOne();
      const s = await m.getRepository(ExamSession).findOne({ where: { id }, relations: this.relations });
      if (!s) throw new NotFoundException('Session introuvable');
      if (s.status !== 'ouverte' || s.startsAt.getTime() <= Date.now())
        throw new BadRequestException('Cette session n’est plus ouverte');
      if (s.places.some((p) => p.student.id === studentId)) throw new ConflictException('Tu as déjà une place');
      if (s.places.length >= s.placesMax) throw new ConflictException('Plus de place dans cette session');
      await this.credits.debit(m, studentId, s.pricePerPlaceMillimes, `Session d’examen : ${s.subject.nameFr}`);
      await m.getRepository(ExamPlace).insert({ session: { id }, student: { id: studentId } });
      return s;
    });
    await this.notifications.notify(
      null,
      s.tutor.user.id,
      'session_reservee',
      {
        subjectFr: s.subject.nameFr,
        subjectAr: s.subject.nameAr,
        subjectEn: s.subject.nameEn,
        taken: s.places.length + 1,
        max: s.placesMax,
      },
      '/espace-tuteur?onglet=sessions',
    );
    return this.detail(id, studentId);
  }

  // ----- Espace tuteur

  async mine(tutorUserId: string) {
    const list = await this.sessions.find({
      where: { tutor: { user: { id: tutorUserId } } },
      relations: this.relations,
      order: { startsAt: 'DESC' },
    });
    return list.map((s) => this.view(s, tutorUserId, true));
  }

  async create(tutorUserId: string, input: CreateSessionInput) {
    const tutor = await this.tutors.findOne({
      where: { user: { id: tutorUserId } },
      relations: { rates: { subject: true } },
    });
    if (!tutor) throw new NotFoundException('Profil tuteur introuvable');
    if (tutor.status !== 'valide')
      throw new BadRequestException('Ton profil doit être validé avant de proposer une session');
    const subject = await this.subjects.findOneBy({ code: input.subjectCode });
    if (!subject) throw new NotFoundException('Matière inconnue');
    if (!tutor.rates.some((r) => r.subject.code === subject.code))
      throw new BadRequestException('Ajoute d’abord cette matière à tes tarifs');
    if (input.startsAt.getTime() < Date.now() + 24 * 3600 * 1000)
      throw new BadRequestException('Prévois la session au moins 24 h à l’avance');
    if (input.placesMin > input.placesMax) throw new BadRequestException('Le minimum ne peut pas dépasser le maximum');
    const saved = await this.sessions.save(
      this.sessions.create({
        tutor,
        subject,
        startsAt: input.startsAt,
        durationMin: input.durationMin,
        placesMin: input.placesMin,
        placesMax: input.placesMax,
        pricePerPlaceMillimes: Math.round(input.pricePerPlaceDt * 1000),
        description: input.description?.trim() ?? '',
      }),
    );
    return this.detail(saved.id, tutorUserId);
  }

  /**
   * Toutes les minutes : une session qui commence sans avoir atteint son minimum est annulée,
   * et chaque inscrit est remboursé en crédits (même règle que les cours individuels).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    const due = await this.sessions.find({
      where: { status: 'ouverte', startsAt: LessThanOrEqual(new Date()) },
      relations: this.relations,
    });
    for (const s of due) {
      if (s.places.length >= s.placesMin) continue;
      await this.sessions.manager.transaction(async (m) => {
        await m.getRepository(ExamSession).update(s.id, { status: 'annulee' });
        const params = { subjectFr: s.subject.nameFr, subjectAr: s.subject.nameAr, subjectEn: s.subject.nameEn };
        for (const p of s.places) {
          await this.credits.record(
            m,
            p.student.id,
            s.pricePerPlaceMillimes,
            'remboursement',
            `Session annulée : ${s.subject.nameFr}`,
          );
          await this.notifications.notify(m, p.student.id, 'session_annulee', params, '/mon-espace?onglet=credits');
        }
        await this.notifications.notify(
          m,
          s.tutor.user.id,
          'session_annulee',
          params,
          '/espace-tuteur?onglet=sessions',
        );
      });
      this.log.log(`Session ${s.id} annulée : ${s.places.length}/${s.placesMin} inscrits`);
    }
  }
}

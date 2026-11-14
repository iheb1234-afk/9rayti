import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { CourseRequest } from '../requests/course-request.entity';
import { publicRating, responseRate } from '../requests/request-state';
import { Rate } from './rate.entity';
import { Slot } from './slot.entity';
import { Subject } from './subject.entity';
import { TutorProfile } from './tutor-profile.entity';

export interface TutorSearch {
  subject?: string;
  maxPrice?: number;
  minRating?: number;
  lang?: string;
  when?: 'semaine' | 'soir' | 'weekend';
  sort?: 'pertinence' | 'prix' | 'note';
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(TutorProfile) private readonly tutors: Repository<TutorProfile>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    @InjectRepository(Rate) private readonly rates: Repository<Rate>,
    @InjectRepository(CourseRequest) private readonly requests: Repository<CourseRequest>,
  ) {}

  listSubjects() {
    return this.subjects.find({ order: { nameFr: 'ASC' } });
  }

  /** Carte tuteur : tout ce qu'il faut pour comparer sans ouvrir le profil. */
  card(t: TutorProfile, subjectCode?: string) {
    const now = Date.now();
    const freeSlots = (t.slots ?? [])
      .filter((s) => !s.booked && s.startsAt.getTime() > now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const rates = (t.rates ?? []).sort((a, b) => a.pricePerHourMillimes - b.pricePerHourMillimes);
    const forSubject = subjectCode ? rates.find((r) => r.subject.code === subjectCode) : undefined;
    return {
      id: t.id,
      firstName: t.user.firstName,
      lastInitial: `${t.user.lastName.charAt(0)}.`,
      school: t.user.school,
      year: t.user.year,
      bio: t.bio,
      languages: t.languages,
      rating: publicRating(t.ratingSum, t.ratingCount),
      ratingCount: t.ratingCount,
      isNew: t.ratingCount < 5,
      hoursTaught: Math.round(t.minutesTaught / 60),
      responseRate: responseRate(t.requestsReceived, t.requestsAnswered),
      subjects: rates.map((r) => ({ ...r.subject, pricePerHourMillimes: r.pricePerHourMillimes })),
      pricePerHourMillimes: (forSubject ?? rates[0])?.pricePerHourMillimes ?? null,
      nextSlot: freeSlots[0]?.startsAt ?? null,
      freeSlotCount: freeSlots.length,
    };
  }

  async search(q: TutorSearch) {
    const tutors = await this.tutors.find({
      where: { status: 'valide' },
      relations: { user: true, rates: { subject: true }, slots: true },
    });
    const cards = tutors
      .filter((t) => !q.subject || t.rates.some((r) => r.subject.code === q.subject))
      .filter((t) => !q.lang || t.languages.includes(q.lang))
      .map((t) => ({ t, card: this.card(t, q.subject) }))
      .filter(({ card }) => q.maxPrice === undefined || (card.pricePerHourMillimes ?? 0) <= q.maxPrice * 1000)
      .filter(({ card }) => q.minRating === undefined || (card.rating ?? 0) >= q.minRating)
      .filter(({ t }) => !q.when || this.hasSlotWhen(t.slots, q.when))
      .map(({ card }) => card);

    // Pertinence : la note compte, mais un tuteur qui laisse expirer ses demandes descend.
    type Card = (typeof cards)[number];
    const score = (c: Card) => (c.rating ?? 4.2) + ((c.responseRate ?? 100) / 100) * 2;
    const sorters: Record<NonNullable<TutorSearch['sort']>, (a: Card, b: Card) => number> = {
      pertinence: (a, b) => score(b) - score(a),
      prix: (a, b) => (a.pricePerHourMillimes ?? 0) - (b.pricePerHourMillimes ?? 0),
      note: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
    };
    return cards.sort(sorters[q.sort ?? 'pertinence']);
  }

  private hasSlotWhen(slots: Slot[], when: NonNullable<TutorSearch['when']>): boolean {
    const now = Date.now();
    const week = now + 7 * 24 * 3600 * 1000;
    return slots.some((s) => {
      const t = s.startsAt.getTime();
      if (s.booked || t < now) return false;
      if (when === 'semaine') return t <= week;
      if (when === 'soir') return t <= now + 24 * 3600 * 1000 && s.startsAt.getHours() >= 17;
      const day = s.startsAt.getDay();
      return t <= week && (day === 0 || day === 6);
    });
  }

  async detail(id: string) {
    const t = await this.tutors.findOne({
      where: { id, status: 'valide' },
      relations: { user: true, rates: { subject: true }, slots: true },
    });
    if (!t) throw new NotFoundException('Ce tuteur n’existe pas ou n’est pas encore validé');
    const done = await this.requests.find({
      where: { tutor: { id }, state: In(['faite', 'versee', 'signalee']) },
      relations: { review: true },
      order: { startsAt: 'DESC' },
      take: 30,
    });
    const reviews = done
      .filter((r) => r.review)
      .map((r) => ({
        author: r.student.firstName,
        subject: r.subject,
        rating: r.review!.rating,
        comment: r.review!.comment,
        date: r.review!.createdAt,
      }));
    const now = Date.now();
    return {
      ...this.card(t),
      declaredAverageVerified: t.declaredAverage !== null,
      slots: t.slots
        .filter((s) => s.startsAt.getTime() > now)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .slice(0, 18)
        .map((s) => ({ id: s.id, startsAt: s.startsAt, durationMin: s.durationMin, booked: s.booked })),
      reviews,
    };
  }

  // ----- Espace tuteur : heures libres et tarifs -----

  async mySlots(tutorUserId: string) {
    const t = await this.profileOf(tutorUserId);
    return this.slots.find({
      where: { tutor: { id: t.id }, startsAt: MoreThan(new Date(Date.now() - 24 * 3600 * 1000)) },
      order: { startsAt: 'ASC' },
    });
  }

  async addSlot(tutorUserId: string, startsAt: Date, durationMin: number) {
    const t = await this.profileOf(tutorUserId);
    if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Choisis une heure dans le futur');
    const exists = await this.slots.exists({ where: { tutor: { id: t.id }, startsAt } });
    if (exists) throw new BadRequestException('Tu as déjà une heure libre à ce moment');
    return this.slots.save(this.slots.create({ tutor: t, startsAt, durationMin }));
  }

  async removeSlot(tutorUserId: string, slotId: number) {
    const t = await this.profileOf(tutorUserId);
    const slot = await this.slots.findOne({ where: { id: slotId, tutor: { id: t.id } } });
    if (!slot) throw new NotFoundException('Heure introuvable');
    if (slot.booked) throw new BadRequestException('Cette heure est déjà demandée par un étudiant');
    await this.slots.delete(slot.id);
    return { ok: true };
  }

  async setRate(tutorUserId: string, subjectCode: string, pricePerHourDt: number) {
    const t = await this.profileOf(tutorUserId);
    const subject = await this.subjects.findOneBy({ code: subjectCode });
    if (!subject) throw new NotFoundException('Matière inconnue');
    const existing = await this.rates.findOne({ where: { tutor: { id: t.id }, subject: { id: subject.id } } });
    const pricePerHourMillimes = Math.round(pricePerHourDt * 1000);
    if (existing) {
      existing.pricePerHourMillimes = pricePerHourMillimes;
      return this.rates.save(existing);
    }
    return this.rates.save(this.rates.create({ tutor: t, subject, pricePerHourMillimes }));
  }

  async profileOf(tutorUserId: string) {
    const t = await this.tutors.findOne({ where: { user: { id: tutorUserId } }, relations: { user: true } });
    if (!t) throw new NotFoundException('Profil tuteur introuvable');
    return t;
  }
}

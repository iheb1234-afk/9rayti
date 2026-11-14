import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CreditsService } from '../credits/credits.service';
import { ExamPlace, ExamSession } from './exam-session.entity';

@Injectable()
export class ExamSessionsService {
  constructor(
    @InjectRepository(ExamSession) private readonly sessions: Repository<ExamSession>,
    private readonly credits: CreditsService,
  ) {}

  private view(s: ExamSession, studentId?: string) {
    const taken = s.places?.length ?? 0;
    return {
      id: s.id,
      subject: s.subject,
      tutor: { id: s.tutor.id, firstName: s.tutor.user.firstName, lastInitial: `${s.tutor.user.lastName.charAt(0)}.` },
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      placesMin: s.placesMin,
      placesMax: s.placesMax,
      placesTaken: taken,
      confirmed: taken >= s.placesMin,
      pricePerPlaceMillimes: s.pricePerPlaceMillimes,
      booked: studentId ? (s.places ?? []).some((p) => p.student?.id === studentId) : false,
    };
  }

  async list(subject?: string, studentId?: string) {
    const list = await this.sessions.find({
      where: { startsAt: MoreThan(new Date()), ...(subject ? { subject: { code: subject } } : {}) },
      relations: { tutor: { user: true }, places: { student: true } },
      order: { startsAt: 'ASC' },
    });
    return list.map((s) => this.view(s, studentId));
  }

  /** Réserve une place : paiement en crédits, dans une transaction avec la session verrouillée. */
  async book(studentId: string, id: string) {
    await this.sessions.manager.transaction(async (m) => {
      await m.getRepository(ExamSession).createQueryBuilder('s').setLock('pessimistic_write').where('s.id = :id', { id }).getOne();
      const s = await m.getRepository(ExamSession).findOne({ where: { id }, relations: { places: { student: true } } });
      if (!s) throw new NotFoundException('Session introuvable');
      if (s.startsAt.getTime() <= Date.now()) throw new BadRequestException('Cette session est passée');
      if (s.places.some((p) => p.student.id === studentId)) throw new ConflictException('Tu as déjà une place');
      if (s.places.length >= s.placesMax) throw new ConflictException('Plus de place dans cette session');
      await this.credits.debit(m, studentId, s.pricePerPlaceMillimes, `Session d’examen : ${s.subject.nameFr}`);
      await m.getRepository(ExamPlace).insert({ session: { id }, student: { id: studentId } });
    });
    const s = await this.sessions.findOneOrFail({ where: { id }, relations: { tutor: { user: true }, places: { student: true } } });
    return this.view(s, studentId);
  }
}

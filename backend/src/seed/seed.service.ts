import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ContactMessage } from '../contact/contact.module';
import { Favorite } from '../favorites/favorite.entity';
import { maskContactInfo } from '../messages/contact-masking';
import { Message } from '../messages/message.entity';
import { Notification, NotificationType } from '../notifications/notification.entity';
import { Rate } from '../catalog/rate.entity';
import { Slot } from '../catalog/slot.entity';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { BOOKING_FEE_MILLIMES } from '../common/money';
import { CreditMovement } from '../credits/credit-movement.entity';
import { ExamPlace, ExamSession } from '../exam-sessions/exam-session.entity';
import { CourseDocument } from '../requests/course-document.entity';
import { CourseRequest } from '../requests/course-request.entity';
import type { RequestState } from '../requests/request-state';
import { Review } from '../requests/review.entity';
import { User } from '../users/user.entity';

const H = 3600 * 1000;
export const DEMO_PASSWORD = 'demo1234';

const SUBJECTS: Array<[string, string, string, string]> = [
  ['probabilites', 'Probabilités', 'الاحتمالات', 'Probability'],
  ['statistique', 'Statistique', 'الإحصاء', 'Statistics'],
  ['analyse-2', 'Analyse 2', 'التحليل 2', 'Calculus 2'],
  ['algebre', 'Algèbre linéaire', 'الجبر الخطي', 'Linear algebra'],
  ['signal', 'Traitement du signal', 'معالجة الإشارة', 'Signal processing'],
  ['transmissions', 'Transmissions numériques', 'الإرسال الرقمي', 'Digital transmissions'],
  ['reseaux', 'Réseaux informatiques', 'الشبكات المعلوماتية', 'Computer networks'],
  ['electromagnetisme', 'Électromagnétisme', 'الكهرومغناطيسية', 'Electromagnetism'],
  ['programmation-c', 'Programmation C', 'البرمجة بلغة C', 'C programming'],
  ['bases-de-donnees', 'Bases de données', 'قواعد البيانات', 'Databases'],
];

/** Date à une heure précise, heure de Tunis (UTC+1), dans `days` jours. */
function tunisAt(days: number, hour: number): Date {
  const d = new Date(Date.now() + days * 24 * H);
  const ymd = d.toISOString().slice(0, 10);
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00+01:00`);
}

/**
 * Jeu de données de démonstration, créé au premier démarrage sur une base vide
 * (désactivable avec SEED=false). Les dates sont relatives à « maintenant ».
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger(SeedService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.SEED === 'false') return;
    if ((await this.db.getRepository(User).count()) > 0) return;
    await this.db.transaction((m) => this.run(m));
    this.log.log(`Données de démonstration créées (mot de passe des comptes : ${DEMO_PASSWORD})`);
  }

  private async run(m: EntityManager) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const subjects = new Map<string, Subject>();
    for (const [code, nameFr, nameAr, nameEn] of SUBJECTS) {
      subjects.set(code, await m.getRepository(Subject).save({ code, nameFr, nameAr, nameEn }));
    }

    const user = (
      email: string,
      role: User['role'],
      firstName: string,
      lastName: string,
      school: string,
      year: string,
    ) =>
      m
        .getRepository(User)
        .save(m.getRepository(User).create({ email, passwordHash: hash, role, firstName, lastName, school, year }));

    const yasmine = await user('yasmine@9rayti.tn', 'etudiant', 'Yasmine', 'Ben Ali', 'ESPRIT', '2e année');
    const omar = await user('omar@9rayti.tn', 'etudiant', 'Omar', 'Belhaj', 'ENIT', '1re année');
    await user('admin@9rayti.tn', 'admin', 'Équipe', '9rayti', '9rayti', '');
    const fillers: User[] = [];
    const people: Array<[string, string, string]> = [
      ['Ines', 'Jaziri', 'ISI'],
      ['Ahmed', 'Saidi', 'ENIT'],
      ['Mariem', 'Chaabane', 'INSAT'],
      ['Skander', 'Ferchichi', 'SUP’COM'],
      ['Rania', 'Mejri', 'ESPRIT'],
      ['Firas', 'Ouni', 'FST'],
      ['Nour', 'Ayari', 'ENSI'],
      ['Aziz', 'Hammami', 'IHEC'],
    ];
    for (const [i, [first, last, school]] of people.entries()) {
      fillers.push(await user(`etudiant${i + 1}@exemple.tn`, 'etudiant', first, last, school, '2e année'));
    }

    const tutor = async (
      u: Promise<User>,
      p: Partial<TutorProfile>,
      rates: Array<[string, number]>,
      slotHours: number[],
    ) => {
      const profile = await m
        .getRepository(TutorProfile)
        .save(m.getRepository(TutorProfile).create({ user: await u, status: 'valide', languages: ['fr'], ...p }));
      for (const [code, dt] of rates) {
        await m
          .getRepository(Rate)
          .save({ tutor: profile, subject: subjects.get(code)!, pricePerHourMillimes: dt * 1000 });
      }
      for (let day = 1; day <= 7; day++) {
        for (const h of slotHours) {
          await m.getRepository(Slot).save({ tutor: profile, startsAt: tunisAt(day, h), durationMin: 60 });
        }
      }
      return profile;
    };

    const sarra = await tutor(
      user('sarra@9rayti.tn', 'tuteur', 'Sarra', 'Bouazizi', 'SUP’COM', '3e année'),
      {
        bio: 'J’ai eu 17/20 en Probabilités l’an dernier. Je pars toujours d’un exercice d’examen, puis on remonte au cours. Je te laisse mon résumé en PDF à la fin.',
        declaredAverage: 16.2,
        languages: ['fr', 'ar'],
        ratingSum: 59,
        ratingCount: 12,
        minutesTaught: 42 * 60,
        requestsReceived: 25,
        requestsAnswered: 24,
      },
      [
        ['probabilites', 20],
        ['statistique', 20],
        ['analyse-2', 18],
      ],
      [18, 20],
    );
    const youssef = await tutor(
      user('youssef@9rayti.tn', 'tuteur', 'Youssef', 'Mansouri', 'ENIT', 'Master'),
      {
        bio: 'Étudiant en master réseaux. J’explique avec des schémas et des captures Wireshark, en français ou en anglais.',
        declaredAverage: 15.1,
        languages: ['fr', 'en'],
        ratingSum: 146,
        ratingCount: 31,
        minutesTaught: 80 * 60,
        requestsReceived: 34,
        requestsAnswered: 31,
      },
      [
        ['probabilites', 25],
        ['reseaux', 25],
        ['transmissions', 28],
      ],
      [10, 19],
    );
    const amira = await tutor(
      user('amira@9rayti.tn', 'tuteur', 'Amira', 'Khelifi', 'INSAT', '4e année'),
      {
        bio: 'Nouvelle sur 9rayti. Je reprends les bases pas à pas, surtout en Analyse et en Algèbre.',
        declaredAverage: 15.6,
        languages: ['fr', 'ar'],
        ratingSum: 10,
        ratingCount: 2,
        minutesTaught: 3 * 60,
        requestsReceived: 3,
        requestsAnswered: 3,
      },
      [
        ['probabilites', 15],
        ['analyse-2', 15],
        ['algebre', 15],
      ],
      [14, 17],
    );
    const mehdi = await tutor(
      user('mehdi@9rayti.tn', 'tuteur', 'Mehdi', 'Trabelsi', 'SUP’COM', '3e année'),
      {
        bio: 'Traitement du signal et transmissions : je prépare les DS avec les sujets des années précédentes.',
        declaredAverage: 15.9,
        languages: ['fr'],
        ratingSum: 41,
        ratingCount: 9,
        minutesTaught: 15 * 60,
        requestsReceived: 12,
        requestsAnswered: 10,
      },
      [
        ['signal', 22],
        ['transmissions', 22],
      ],
      [15, 21],
    );
    // Candidature en attente, visible dans l'espace admin.
    const nour = await m.getRepository(TutorProfile).save(
      m.getRepository(TutorProfile).create({
        user: await user('nour@9rayti.tn', 'tuteur', 'Nour', 'Gharbi', 'FST', '3e année'),
        status: 'en_attente',
        declaredAverage: 15.8,
        bio: 'Bases de données et SQL.',
        languages: ['fr', 'ar'],
      }),
    );
    await m
      .getRepository(Rate)
      .save({ tutor: nour, subject: subjects.get('bases-de-donnees')!, pricePerHourMillimes: 18000 });

    // Crédits de Yasmine : une recharge, puis les paiements ci-dessous (solde final : 15 DT).
    await m.getRepository(CreditMovement).save({
      user: yasmine,
      amountMillimes: 107_000,
      reason: 'recharge',
      label: 'Recharge par carte (simulée)',
    });

    const request = async (
      student: User,
      t: TutorProfile,
      code: string,
      startsAt: Date,
      state: RequestState,
      o: {
        payWith?: 'credits' | 'carte';
        createdAgoH: number;
        doneAgoH?: number;
        review?: [number, string];
        attachment?: string;
      },
    ) => {
      const rate = await m.getRepository(Rate).findOneOrFail({ where: { tutor: { id: t.id }, subject: { code } } });
      const booked = !['expiree', 'refusee', 'annulee'].includes(state);
      const existing = await m.getRepository(Slot).findOne({ where: { tutor: { id: t.id }, startsAt } });
      const slot = existing
        ? await m.getRepository(Slot).save({ ...existing, booked })
        : await m.getRepository(Slot).save({ tutor: t, startsAt, durationMin: 60, booked });
      const id = randomUUID();
      const created = new Date(Date.now() - o.createdAgoH * H);
      const payWith = o.payWith ?? 'credits';
      const r = await m.getRepository(CourseRequest).save({
        id,
        student,
        tutor: t,
        subject: subjects.get(code)!,
        slot,
        startsAt,
        durationMin: 60,
        state,
        amountMillimes: rate.pricePerHourMillimes,
        feeMillimes: BOOKING_FEE_MILLIMES,
        payWith,
        attachmentName: o.attachment ?? null,
        message: '',
        expiresAt: new Date(created.getTime() + 12 * H),
        answeredAt: ['acceptee', 'faite', 'versee'].includes(state) ? new Date(created.getTime() + 2 * H) : null,
        doneAt: o.doneAgoH !== undefined ? new Date(Date.now() - o.doneAgoH * H) : null,
        payoutAt: o.doneAgoH !== undefined ? new Date(Date.now() - o.doneAgoH * H + 24 * H) : null,
        jitsiRoom: `9rayti-${id.slice(0, 8)}`,
        reportReason: null,
      });
      await m.getRepository(CourseRequest).update(id, { createdAt: created });
      const total = rate.pricePerHourMillimes + BOOKING_FEE_MILLIMES;
      if (payWith === 'credits') {
        await m.getRepository(CreditMovement).save({
          user: student,
          amountMillimes: -total,
          reason: 'paiement',
          label: `Cours de ${subjects.get(code)!.nameFr}`,
          requestId: id,
        });
        if (state === 'expiree') {
          await m.getRepository(CreditMovement).save({
            user: student,
            amountMillimes: total,
            reason: 'remboursement',
            label: `Remboursement : ${subjects.get(code)!.nameFr} (expirée)`,
            requestId: id,
          });
        }
      }
      if (o.review) {
        const rv = await m.getRepository(Review).save({ request: r, rating: o.review[0], comment: o.review[1] });
        await m
          .getRepository(Review)
          .update(rv.id, { createdAt: new Date(Date.now() - (o.doneAgoH ?? 0) * H + 2 * H) });
      }
      return r;
    };

    const accepted = await request(yasmine, sarra, 'probabilites', tunisAt(1, 20), 'acceptee', {
      createdAgoH: 20,
      attachment: 'Chapitre 4 - lois continues.pdf',
    });
    await request(yasmine, youssef, 'reseaux', tunisAt(2, 10), 'en_attente', { createdAgoH: 3 });
    await request(yasmine, mehdi, 'signal', tunisAt(-1, 15), 'expiree', { createdAgoH: 40 });
    const done = await request(yasmine, amira, 'analyse-2', tunisAt(-1, 17), 'faite', { createdAgoH: 30, doneAgoH: 4 });
    const past = await request(yasmine, sarra, 'probabilites', tunisAt(-5, 18), 'versee', {
      createdAgoH: 140,
      doneAgoH: 118,
      review: [5, 'Elle explique avec des exercices d’examen, j’ai enfin compris les lois continues.'],
    });
    await request(omar, sarra, 'statistique', tunisAt(3, 18), 'en_attente', {
      createdAgoH: 9,
      payWith: 'carte',
      attachment: 'TD3 - estimation.pdf',
    });
    await request(omar, sarra, 'probabilites', tunisAt(-9, 20), 'versee', {
      createdAgoH: 230,
      doneAgoH: 214,
      payWith: 'carte',
      review: [5, 'Très claire, et le replay m’a sauvé la veille du DS.'],
    });

    for (const r of [accepted, past, done]) {
      await m
        .getRepository(CourseDocument)
        .save({ request: r, kind: 'pdf', name: 'Résumé - lois continues.pdf', url: 'docs/resume-lois-continues.pdf' });
    }
    await m
      .getRepository(CourseDocument)
      .save({ request: past, kind: 'pdf', name: 'Exercices corrigés.pdf', url: 'docs/exercices-corriges.pdf' });

    const session = async (
      t: TutorProfile,
      code: string,
      startsAt: Date,
      durationMin: number,
      min: number,
      max: number,
      dt: number,
      taken: User[],
      description = '',
    ) => {
      const s = await m.getRepository(ExamSession).save({
        tutor: t,
        subject: subjects.get(code)!,
        startsAt,
        durationMin,
        placesMin: min,
        placesMax: max,
        pricePerPlaceMillimes: dt * 1000,
        description,
      });
      for (const student of taken) await m.getRepository(ExamPlace).save({ session: s, student });
    };
    await session(
      sarra,
      'probabilites',
      tunisAt(4, 10),
      120,
      4,
      8,
      12,
      [omar, ...fillers.slice(0, 4)],
      'Lois continues, vecteurs aléatoires et deux sujets de DS corrigés en direct. Apporte tes questions.',
    );
    await session(
      mehdi,
      'signal',
      tunisAt(5, 15),
      120,
      4,
      8,
      14,
      fillers.slice(4, 7),
      'Transformée de Fourier, filtrage et échantillonnage : les exercices qui tombent chaque année.',
    );
    await session(
      amira,
      'analyse-2',
      tunisAt(6, 18),
      180,
      5,
      10,
      15,
      fillers,
      'Intégrales généralisées et séries : méthode pas à pas, puis un examen blanc chronométré.',
    );

    // Avis plus anciens, pour le carrousel de l'accueil et les profils.
    const older: Array<[User, TutorProfile, string, number, string]> = [
      [
        fillers[1],
        youssef,
        'reseaux',
        5,
        'Il m’a fait comprendre OSPF en une heure, avec des captures Wireshark. Top.',
      ],
      [
        fillers[2],
        mehdi,
        'signal',
        5,
        'Les sujets des années précédentes, corrigés pas à pas : exactement ce qu’il me fallait.',
      ],
      [fillers[3], amira, 'analyse-2', 5, 'Très patiente, elle reprend les bases sans jamais juger. Je recommande.'],
      [fillers[4], sarra, 'statistique', 4, 'Clair et efficace. Le résumé PDF à la fin est un vrai plus.'],
      [
        fillers[5],
        youssef,
        'transmissions',
        5,
        'Explications en anglais et en français, ça m’a aidée pour le cours en anglais.',
      ],
    ];
    for (const [i, [student, t, code, stars, text]] of older.entries()) {
      await request(student, t, code, tunisAt(-12 - i * 2, 18), 'versee', {
        createdAgoH: 300 + i * 48,
        doneAgoH: 280 + i * 48,
        payWith: 'carte',
        review: [stars, text],
      });
    }

    // --- Objectif 4 : signalement à trancher, comptes rendus, messages, favoris, notifications, contact
    const reported = await request(omar, mehdi, 'transmissions', tunisAt(-1, 15), 'faite', {
      createdAgoH: 40,
      doneAgoH: 6,
      payWith: 'carte',
    });
    await m.getRepository(CourseRequest).update(reported.id, {
      state: 'signalee',
      reportReason: 'Le tuteur s’est connecté avec 25 minutes de retard et le cours a duré une demi-heure.',
    });
    await m.getRepository(CourseRequest).update(past.id, {
      recap:
        'Lois uniforme, exponentielle et normale ; centrer-réduire. À refaire : exercices 3 et 5 du TD 4 avant le DS.',
    });
    await m.getRepository(CourseRequest).update(done.id, {
      recap: 'Intégrales impropres : critères de comparaison et d’équivalence. Prochaine fois : séries numériques.',
    });

    const say = async (
      student: User,
      t: TutorProfile,
      from: 'etudiant' | 'tuteur',
      text: string,
      agoMin: number,
      read = true,
    ) => {
      const { text: body, masked } = maskContactInfo(text);
      const msg = await m
        .getRepository(Message)
        .save({ student, tutor: t, fromRole: from, body, masked, readAt: read ? new Date() : null });
      await m.getRepository(Message).update(msg.id, { createdAt: new Date(Date.now() - agoMin * 60_000) });
    };
    await say(
      yasmine,
      sarra,
      'etudiant',
      'Bonsoir Sarra ! Pour demain, on peut commencer par les lois continues ? Je bloque sur la loi normale.',
      1300,
    );
    await say(
      yasmine,
      sarra,
      'tuteur',
      'Bonsoir Yasmine, oui bien sûr. Envoie-moi ton TD dans la demande, je prépare deux exercices du DS de l’an dernier.',
      1290,
    );
    await say(
      yasmine,
      sarra,
      'etudiant',
      'Super, merci ! Sinon je peux t’écrire sur WhatsApp au 22 345 678 si besoin ?',
      1285,
    );
    await say(
      yasmine,
      sarra,
      'tuteur',
      'On reste ici, c’est plus simple : tout est dans la salle de cours et tu es remboursée s’il y a un souci 🙂',
      1280,
    );
    await say(
      yasmine,
      youssef,
      'etudiant',
      'Bonjour Youssef, tu peux aussi expliquer le routage OSPF ? C’est pour le DS de réseaux.',
      170,
    );
    await say(
      yasmine,
      youssef,
      'tuteur',
      'Bonjour ! Oui, OSPF et les zones, avec une capture Wireshark. Je réponds à ta demande ce soir.',
      150,
      false,
    );
    await say(
      omar,
      sarra,
      'etudiant',
      'Salut, est-ce que la session de samedi couvre aussi les vecteurs aléatoires ?',
      600,
    );

    await m.getRepository(Favorite).save([
      { student: yasmine, tutor: sarra },
      { student: yasmine, tutor: youssef },
      { student: omar, tutor: sarra },
    ]);

    const subj = (code: string) => {
      const x = subjects.get(code)!;
      return { subjectFr: x.nameFr, subjectAr: x.nameAr, subjectEn: x.nameEn };
    };
    const note = async (
      u: User,
      type: NotificationType,
      params: Record<string, string | number>,
      link: string,
      agoMin: number,
      read = false,
    ) => {
      const n = await m
        .getRepository(Notification)
        .save({ user: u, type, params, link, readAt: read ? new Date() : null });
      await m.getRepository(Notification).update(n.id, { createdAt: new Date(Date.now() - agoMin * 60_000) });
    };
    const sarraUser = await m.getRepository(User).findOneByOrFail({ email: 'sarra@9rayti.tn' });
    const admin = await m.getRepository(User).findOneByOrFail({ email: 'admin@9rayti.tn' });
    await note(yasmine, 'message', { from: 'Youssef' }, `/messages/${youssef.id}`, 150);
    await note(yasmine, 'cours_termine', { from: 'Amira K.', ...subj('analyse-2') }, '/mon-espace', 240);
    await note(
      yasmine,
      'demande_acceptee',
      { from: 'Sarra B.', ...subj('probabilites') },
      `/salle/${accepted.id}`,
      1080,
      true,
    );
    await note(
      yasmine,
      'demande_expiree',
      { from: 'Mehdi T.', ...subj('signal') },
      '/mon-espace?onglet=credits',
      1680,
      true,
    );
    await note(sarraUser, 'demande_recue', { from: 'Omar', ...subj('statistique') }, '/espace-tuteur', 540);
    await note(
      sarraUser,
      'session_reservee',
      { taken: 5, max: 8, ...subj('probabilites') },
      '/espace-tuteur?onglet=sessions',
      900,
    );
    await note(
      sarraUser,
      'versement',
      { from: 'Omar', amount: 20000, ...subj('probabilites') },
      '/espace-tuteur?onglet=revenus',
      8000,
      true,
    );
    await note(admin, 'signalement', { from: 'Omar', ...subj('transmissions') }, '/admin?onglet=signalements', 300);
    await note(admin, 'contact', { from: 'Lina', topic: 'partenariat' }, '/admin?onglet=contact', 90);

    await m.getRepository(ContactMessage).save({
      name: 'Lina Haddad',
      email: 'lina.haddad@exemple.tn',
      topic: 'partenariat',
      message:
        'Bonjour, je représente le club scientifique de l’INSAT. Nous aimerions proposer des sessions d’examen à nos membres avant les DS de décembre.',
    });
  }
}

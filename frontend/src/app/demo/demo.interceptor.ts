import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Classroom,
  CourseRequest,
  CreditHistory,
  ExamSession,
  Slot,
  Subject,
  SubjectPrice,
  TutorDetail,
  User,
} from '../core/api/models';
import fixture from './fixture.json';

/**
 * Mode démonstration (GitHub Pages, sans serveur) : un petit « faux serveur » en mémoire qui
 * reproduit les règles de l'API NestJS (12 h pour répondre, remboursement en crédits, une seule
 * réservation par créneau…) à partir de données capturées sur la vraie API. L'état est gardé
 * dans le navigateur (localStorage) pour survivre au rechargement.
 */
type Req = CourseRequest & { jitsiRoom?: string; documents?: Classroom['documents'] };
interface Db {
  users: (User & { password: string })[];
  tutors: Record<string, TutorDetail>;
  requests: Record<string, Req>;
  credits: Record<string, CreditHistory>;
  rates: Record<string, SubjectPrice[]>;
  pending: {
    id: string;
    name: string;
    email: string;
    school: string;
    year: string;
    declaredAverage: number | null;
    subjects: string[];
    createdAt: string;
  }[];
  sessions: (ExamSession & { bookedBy: string[] })[];
}

const KEY = '9rayti.demo.db.v1';
const FEE = 3000;
const H = 3_600_000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Décale toutes les dates de la capture pour qu'elles restent relatives à « maintenant ». */
function shiftDates<T>(value: T, ms: number): T {
  if (typeof value === 'string' && ISO.test(value))
    return new Date(new Date(value).getTime() + ms).toISOString() as T;
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, ms)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, ms)])) as T;
  return value;
}

function fresh(): Db {
  // Décalage arrondi à l'heure : les créneaux restent « pile » (18:00, 20:00…).
  const shift = Math.round((Date.now() - new Date(fixture.capturedAt).getTime()) / H) * H;
  const f = shiftDates(structuredClone(fixture), shift) as unknown as typeof fixture;
  const requests: Record<string, Req> = {};
  for (const [id, r] of Object.entries(f.requests as Record<string, Req>)) {
    const room = (f.classrooms as Record<string, Classroom>)[id];
    requests[id] = {
      ...r,
      jitsiRoom: room?.jitsiRoom ?? `9rayti-${id.slice(0, 8)}`,
      documents: room?.documents ?? [],
    };
  }
  const tutors = f.tutors as unknown as Record<string, TutorDetail>;
  const rates: Record<string, SubjectPrice[]> = {};
  for (const [userId, x] of Object.entries(
    f.tutorExtra as Record<string, { rates: SubjectPrice[]; slots: Slot[] }>,
  )) {
    rates[userId] = x.rates;
    const profileId = (f.users as User[]).find((u) => u.id === userId)?.tutorProfileId;
    if (profileId && tutors[profileId])
      tutors[profileId].slots = x.slots.filter((s) => +new Date(s.startsAt) > Date.now());
  }
  return {
    users: (f.users as User[]).map((u) => ({ ...u, password: 'demo1234' })),
    tutors,
    requests,
    rates,
    credits: f.credits as unknown as Record<string, CreditHistory>,
    pending: f.pending,
    sessions: f.examSessions as unknown as Db['sessions'],
  };
}

let db: Db = load();
function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* stockage indisponible */
  }
  return fresh();
}
function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* stockage indisponible */
  }
}

const ok = <T>(body: T, status = 200) => of(new HttpResponse({ status, body })).pipe(delay(180));
const fail = (status: number, message: string) =>
  throwError(() => new HttpErrorResponse({ status, error: { statusCode: status, message } })).pipe(
    delay(180),
  ) as Observable<never>;

function userOf(req: HttpRequest<unknown>) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  return db.users.find((u) => `demo.${u.id}` === token) ?? null;
}
const publicUser = (u: Db['users'][number]): User => {
  const { password: _password, ...rest } = u;
  void _password;
  return { ...rest, balanceMillimes: u.role === 'etudiant' ? balance(u.id) : undefined };
};
const balance = (id: string) =>
  (db.credits[id]?.movements ?? []).reduce((s, m) => s + m.amountMillimes, 0);
function move(
  userId: string,
  amountMillimes: number,
  reason: 'recharge' | 'paiement' | 'remboursement',
  label: string,
  requestId: string | null = null,
) {
  const h = (db.credits[userId] ??= { balanceMillimes: 0, movements: [] });
  h.movements.unshift({
    id: Date.now() + Math.random(),
    amountMillimes,
    reason,
    label,
    requestId,
    createdAt: new Date().toISOString(),
  });
  h.balanceMillimes = balance(userId);
}
const card = (t: TutorDetail) => {
  const { slots, reviews: _r, declaredAverageVerified: _d, ...c } = t;
  void _r;
  void _d;
  const free = slots.filter((s) => !s.booked && +new Date(s.startsAt) > Date.now());
  return { ...c, nextSlot: free[0]?.startsAt ?? null, freeSlotCount: free.length };
};

/** Expiration après 12 h et versement 24 h après le cours, comme la tâche planifiée du serveur. */
function sweep(): void {
  const now = Date.now();
  for (const r of Object.values(db.requests)) {
    if (r.state === 'en_attente' && +new Date(r.expiresAt) <= now) refund(r, 'expiree');
    if (r.state === 'faite' && r.payoutAt && +new Date(r.payoutAt) <= now) {
      r.state = 'versee';
      r.canReport = false;
    }
  }
}
function refund(r: Req, state: Req['state']): void {
  r.state = state;
  const t = db.tutors[r.tutor.id];
  const slot = t?.slots.find((s) => s.startsAt === r.startsAt);
  if (slot) slot.booked = false;
  if (r.payWith === 'credits')
    move(
      r.student.id,
      r.totalMillimes,
      'remboursement',
      `Remboursement : ${r.subject.nameFr}`,
      r.id,
    );
}
const viewFor = (r: Req, u: User): Req => ({
  ...r,
  canReview: u.role === 'etudiant' && ['faite', 'versee'].includes(r.state) && !r.review,
  canReport:
    u.role === 'etudiant' &&
    r.state === 'faite' &&
    !!r.payoutAt &&
    +new Date(r.payoutAt) > Date.now(),
});

export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  sweep();
  const path = req.url.slice(environment.apiUrl.length).split('?')[0];
  const body = (req.body ?? {}) as Record<string, unknown>;
  const u = userOf(req);
  const m = req.method;
  const seg = path.split('/').filter(Boolean);
  const done = <T>(value: T, status = 200) => {
    save();
    return ok(value, status);
  };

  // Comptes
  if (m === 'POST' && path === '/auth/login') {
    const found = db.users.find(
      (x) => x.email === String(body['email']).toLowerCase() && x.password === body['password'],
    );
    return found
      ? ok({ token: `demo.${found.id}`, user: publicUser(found) })
      : fail(401, 'E-mail ou mot de passe incorrect');
  }
  if (m === 'POST' && path === '/auth/register') {
    const email = String(body['email']).toLowerCase();
    if (db.users.some((x) => x.email === email))
      return fail(409, 'Un compte existe déjà avec cet e-mail');
    const id = crypto.randomUUID();
    const tutor = body['role'] === 'tuteur';
    const nu = {
      id,
      email,
      password: String(body['password']),
      role: body['role'] as User['role'],
      firstName: String(body['firstName']),
      lastName: String(body['lastName']),
      school: String(body['school']),
      year: String(body['year']),
      lang: (body['lang'] as User['lang']) ?? 'fr',
      tutorStatus: tutor ? ('en_attente' as const) : null,
      tutorProfileId: tutor ? crypto.randomUUID() : null,
    };
    db.users.push(nu);
    if (tutor) {
      const subs = (body['subjects'] as { code: string; pricePerHourDt: number }[]) ?? [];
      db.rates[id] = subs.map((s) => ({
        ...(fixture.subjects as Subject[]).find((x) => x.code === s.code)!,
        pricePerHourMillimes: s.pricePerHourDt * 1000,
      }));
      db.pending.push({
        id: nu.tutorProfileId!,
        name: `${nu.firstName} ${nu.lastName}`,
        email,
        school: nu.school,
        year: nu.year,
        declaredAverage: Number(body['declaredAverage'] ?? null),
        subjects: db.rates[id].map((r) => r.nameFr),
        createdAt: new Date().toISOString(),
      });
    } else db.credits[id] = { balanceMillimes: 0, movements: [] };
    return done({ token: `demo.${id}`, user: publicUser(nu) }, 201);
  }

  // Catalogue (public)
  if (m === 'GET' && path === '/subjects') return ok(fixture.subjects);
  if (m === 'GET' && path === '/tutors') {
    const p = req.params;
    const subject = p.get('subject');
    const maxPrice = Number(p.get('maxPrice') ?? 0);
    const minRating = Number(p.get('minRating') ?? 0);
    const lang = p.get('lang');
    const sort = p.get('sort') ?? 'pertinence';
    let list = Object.values(db.tutors).map((t) => {
      const c = card(t);
      const price = subject
        ? (c.subjects.find((s) => s.code === subject)?.pricePerHourMillimes ?? null)
        : Math.min(...c.subjects.map((s) => s.pricePerHourMillimes));
      return { ...c, pricePerHourMillimes: price };
    });
    if (subject) list = list.filter((c) => c.subjects.some((s) => s.code === subject));
    if (maxPrice) list = list.filter((c) => (c.pricePerHourMillimes ?? 0) <= maxPrice * 1000);
    if (minRating) list = list.filter((c) => (c.rating ?? 0) >= minRating);
    if (lang) list = list.filter((c) => c.languages.includes(lang as User['lang']));
    const score = (c: (typeof list)[number]) =>
      (c.rating ?? 4.2) + ((c.responseRate ?? 100) / 100) * 2;
    list.sort((a, b) =>
      sort === 'prix'
        ? (a.pricePerHourMillimes ?? 0) - (b.pricePerHourMillimes ?? 0)
        : sort === 'note'
          ? (b.rating ?? 0) - (a.rating ?? 0)
          : score(b) - score(a),
    );
    return ok(list);
  }
  if (m === 'GET' && seg[0] === 'tutors' && seg[1]) {
    const t = db.tutors[seg[1]];
    return t
      ? ok({
          ...t,
          ...card(t),
          slots: t.slots.filter((s) => +new Date(s.startsAt) > Date.now()).slice(0, 18),
        })
      : fail(404, 'Ce tuteur n’existe pas ou n’est pas encore validé');
  }
  if (m === 'GET' && path === '/exam-sessions')
    return ok(db.sessions.map((s) => ({ ...s, booked: false })));

  // Tout le reste demande une session
  if (!u) return fail(401, 'Connexion requise');
  const profileId = u.tutorProfileId;

  if (m === 'GET' && path === '/auth/me') return ok(publicUser(u));
  if (m === 'PATCH' && path === '/auth/me/lang') {
    u.lang = body['lang'] as User['lang'];
    return done(publicUser(u));
  }
  if (m === 'GET' && path === '/credits/me')
    return ok({ ...(db.credits[u.id] ?? { movements: [] }), balanceMillimes: balance(u.id) });
  if (m === 'POST' && path === '/credits/recharge') {
    move(u.id, Number(body['amountDt']) * 1000, 'recharge', 'Recharge par carte (simulée)');
    return done({ ...db.credits[u.id], balanceMillimes: balance(u.id) }, 201);
  }

  if (m === 'GET' && path === '/exam-sessions/mine')
    return ok(db.sessions.map((s) => ({ ...s, booked: s.bookedBy.includes(u.id) })));
  if (m === 'POST' && seg[0] === 'exam-sessions' && seg[2] === 'book') {
    const s = db.sessions.find((x) => x.id === seg[1]);
    if (!s) return fail(404, 'Session introuvable');
    if (s.bookedBy.includes(u.id)) return fail(409, 'Tu as déjà une place dans cette session');
    if (s.placesTaken >= s.placesMax) return fail(409, 'Cette session est complète');
    if (balance(u.id) < s.pricePerPlaceMillimes)
      return fail(400, 'Solde de crédits insuffisant : recharge ou paie par carte.');
    move(u.id, -s.pricePerPlaceMillimes, 'paiement', `Session d’examen : ${s.subject.nameFr}`);
    s.bookedBy.push(u.id);
    s.placesTaken++;
    s.confirmed = s.placesTaken >= s.placesMin;
    return done({ ...s, booked: true }, 201);
  }

  // Demandes de cours
  const all = Object.values(db.requests);
  if (m === 'GET' && path === '/requests/mine')
    return ok(
      all
        .filter((r) => r.student.id === u.id)
        .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))
        .map((r) => viewFor(r, u)),
    );
  if (m === 'GET' && path === '/tutor/requests')
    return ok(all.filter((r) => r.tutor.id === profileId).map((r) => viewFor(r, u)));
  if (m === 'POST' && path === '/requests') {
    const t = db.tutors[String(body['tutorId'])];
    const slot = t?.slots.find((s) => s.id === Number(body['slotId']));
    const subj = t?.subjects.find((s) => s.code === body['subjectCode']);
    if (!t || !slot || !subj) return fail(400, 'Créneau ou matière invalide');
    if (slot.booked) return fail(409, 'Cette heure vient d’être prise : choisis-en une autre');
    const total = subj.pricePerHourMillimes + FEE;
    if (body['payWith'] === 'credits') {
      if (balance(u.id) < total)
        return fail(400, 'Solde de crédits insuffisant : recharge ou paie par carte.');
    }
    const id = crypto.randomUUID();
    slot.booked = true;
    const r: Req = {
      id,
      state: 'en_attente',
      subject: (fixture.subjects as Subject[]).find((s) => s.code === subj.code)!,
      startsAt: slot.startsAt,
      durationMin: slot.durationMin,
      amountMillimes: subj.pricePerHourMillimes,
      feeMillimes: FEE,
      totalMillimes: total,
      payWith: body['payWith'] as Req['payWith'],
      attachmentName: (body['attachmentName'] as string) ?? null,
      message: (body['message'] as string) ?? '',
      expiresAt: new Date(Date.now() + 12 * H).toISOString(),
      answeredAt: null,
      doneAt: null,
      payoutAt: null,
      reportReason: null,
      createdAt: new Date().toISOString(),
      student: { id: u.id, firstName: u.firstName, school: u.school },
      tutor: { id: t.id, firstName: t.firstName, lastInitial: t.lastInitial },
      review: null,
      canReview: false,
      canReport: false,
      jitsiRoom: `9rayti-${id.slice(0, 8)}`,
      documents: [],
    };
    if (r.payWith === 'credits') move(u.id, -total, 'paiement', `Cours de ${r.subject.nameFr}`, id);
    db.requests[id] = r;
    return done(viewFor(r, u), 201);
  }
  if (seg[0] === 'requests' && seg[1] && m === 'POST') {
    const r = db.requests[seg[1]];
    if (!r) return fail(404, 'Demande introuvable');
    const mine = u.role === 'etudiant' ? r.student.id === u.id : r.tutor.id === profileId;
    if (!mine) return fail(403, 'Cette demande ne te concerne pas');
    const need = (from: Req['state'][], action: string) =>
      from.includes(r.state)
        ? null
        : fail(400, `Action « ${action} » impossible depuis l'état « ${r.state} »`);
    const t = db.tutors[r.tutor.id];
    switch (seg[2]) {
      case 'cancel': {
        const e = need(['en_attente'], 'annuler');
        if (e) return e;
        refund(r, 'annulee');
        break;
      }
      case 'accept': {
        const e = need(['en_attente'], 'accepter');
        if (e) return e;
        r.state = 'acceptee';
        r.answeredAt = new Date().toISOString();
        break;
      }
      case 'refuse': {
        const e = need(['en_attente'], 'refuser');
        if (e) return e;
        r.answeredAt = new Date().toISOString();
        refund(r, 'refusee');
        break;
      }
      case 'tutor-cancel': {
        const e = need(['acceptee'], 'annuler_tuteur');
        if (e) return e;
        refund(r, 'annulee_tuteur');
        break;
      }
      case 'complete': {
        const e = need(['acceptee'], 'terminer');
        if (e) return e;
        r.state = 'faite';
        r.doneAt = new Date().toISOString();
        r.payoutAt = new Date(Date.now() + 24 * H).toISOString();
        if (t) t.hoursTaught += Math.round(r.durationMin / 60);
        break;
      }
      case 'report': {
        const e = need(['faite'], 'signaler');
        if (e) return e;
        r.state = 'signalee';
        r.reportReason = String(body['reason']);
        break;
      }
      case 'review': {
        if (!['faite', 'versee'].includes(r.state))
          return fail(400, 'Tu pourras noter ce cours une fois terminé');
        if (r.review) return fail(409, 'Tu as déjà noté ce cours');
        r.review = { rating: Number(body['rating']), comment: String(body['comment'] ?? '') };
        if (t) {
          t.reviews.unshift({
            author: u.firstName,
            subject: r.subject,
            rating: r.review.rating,
            comment: r.review.comment,
            date: new Date().toISOString(),
          });
          const sum = (t.rating ?? 0) * t.ratingCount + r.review.rating;
          t.ratingCount++;
          t.rating = t.ratingCount >= 5 ? Math.round((sum / t.ratingCount) * 10) / 10 : null;
          t.isNew = t.ratingCount < 5;
        }
        return done(viewFor(r, u), 201);
      }
      default:
        return fail(404, 'Route inconnue');
    }
    return done(viewFor(r, u));
  }

  // Salle de cours
  if (seg[0] === 'classroom' && seg[1]) {
    const r = db.requests[seg[1]];
    if (!r || !(r.student.id === u.id || r.tutor.id === profileId))
      return fail(403, 'Cette salle ne te concerne pas');
    if (!['acceptee', 'faite', 'versee', 'signalee'].includes(r.state))
      return fail(403, 'La salle ouvre quand le tuteur a accepté la demande');
    if (m === 'POST' && seg[2] === 'documents') {
      const doc = {
        id: Date.now(),
        kind: body['kind'] as 'pdf' | 'replay',
        name: String(body['name']),
        url: String(body['url']),
      };
      r.documents = [...(r.documents ?? []), doc];
      return done(doc, 201);
    }
    return ok({
      ...viewFor(r, u),
      role: u.role,
      jitsiRoom: r.jitsiRoom,
      jitsiUrl: `https://meet.jit.si/${r.jitsiRoom}`,
      documents: r.documents ?? [],
    });
  }

  // Espace tuteur
  if (path === '/tutor/dashboard') {
    const mine = all.filter((r) => r.tutor.id === profileId);
    const t = profileId ? db.tutors[profileId] : undefined;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const next =
      mine
        .filter((r) => r.state === 'acceptee' && +new Date(r.startsAt) > Date.now() - 2 * H)
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0] ?? null;
    return ok({
      status: u.tutorStatus ?? 'en_attente',
      earnedThisMonthMillimes: mine
        .filter((r) => r.state === 'versee' && r.doneAt && new Date(r.doneAt) >= monthStart)
        .reduce((s, r) => s + r.amountMillimes, 0),
      pendingPayoutMillimes: mine
        .filter((r) => r.state === 'faite')
        .reduce((s, r) => s + r.amountMillimes, 0),
      responseRate: t?.responseRate ?? null,
      rating: t?.rating ?? null,
      ratingCount: t?.ratingCount ?? 0,
      hoursTaught: t?.hoursTaught ?? 0,
      nextCourse: next,
      pendingRequests: mine.filter((r) => r.state === 'en_attente').length,
    });
  }
  if (path === '/tutor/slots') {
    const t = profileId ? db.tutors[profileId] : undefined;
    if (m === 'GET') return ok(t?.slots ?? []);
    if (m === 'POST') {
      const startsAt = new Date(String(body['startsAt'])).toISOString();
      if (+new Date(startsAt) <= Date.now()) return fail(400, 'Choisis une heure dans le futur');
      if (!t) return fail(400, 'Ton profil doit être validé pour ouvrir des heures (mode démo)');
      if (t.slots.some((s) => s.startsAt === startsAt))
        return fail(400, 'Tu as déjà une heure libre à ce moment');
      const slot = {
        id: Date.now(),
        startsAt,
        durationMin: Number(body['durationMin']),
        booked: false,
      };
      t.slots = [...t.slots, slot].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      return done(slot, 201);
    }
  }
  if (m === 'DELETE' && seg[0] === 'tutor' && seg[1] === 'slots') {
    const t = profileId ? db.tutors[profileId] : undefined;
    const s = t?.slots.find((x) => x.id === Number(seg[2]));
    if (!t || !s) return fail(404, 'Heure introuvable');
    if (s.booked) return fail(400, 'Cette heure est déjà réservée');
    t.slots = t.slots.filter((x) => x !== s);
    return done(null);
  }
  if (path === '/tutor/rates') {
    if (m === 'GET') return ok(db.rates[u.id] ?? []);
    const code = String(body['subjectCode']);
    const price = Number(body['pricePerHourDt']) * 1000;
    const subj = (fixture.subjects as Subject[]).find((s) => s.code === code)!;
    const list = (db.rates[u.id] ??= []);
    const existing = list.find((r) => r.code === code);
    if (existing) existing.pricePerHourMillimes = price;
    else list.push({ ...subj, pricePerHourMillimes: price });
    const t = profileId ? db.tutors[profileId] : undefined;
    if (t)
      t.subjects = list.map((r) => ({
        code: r.code,
        nameFr: r.nameFr,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        pricePerHourMillimes: r.pricePerHourMillimes,
      }));
    return done({ code, pricePerHourMillimes: price });
  }

  // Administration
  if (u.role === 'admin') {
    if (path === '/admin/overview') {
      const by = new Map<string, { state: Req['state']; count: number; volumeMillimes: number }>();
      for (const r of all) {
        const x = by.get(r.state) ?? { state: r.state, count: 0, volumeMillimes: 0 };
        x.count++;
        x.volumeMillimes += r.totalMillimes;
        by.set(r.state, x);
      }
      return ok({
        tutors: { validated: Object.keys(db.tutors).length, pending: db.pending.length },
        requests: [...by.values()],
      });
    }
    if (path === '/admin/tutors/pending') return ok(db.pending);
    if (seg[1] === 'tutors' && seg[3] === 'validate') {
      db.pending = db.pending.filter((p) => p.id !== seg[2]);
      const tu = db.users.find((x) => x.tutorProfileId === seg[2]);
      if (tu) tu.tutorStatus = 'valide';
      return done({ id: seg[2], status: 'valide' });
    }
  }
  return fail(404, 'Route inconnue en mode démo');
};

/** Remet la démo à zéro (bouton « Réinitialiser la démo »). */
export function resetDemo(): void {
  db = fresh();
  save();
}

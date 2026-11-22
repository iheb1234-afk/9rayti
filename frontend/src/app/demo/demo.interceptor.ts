import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AppNotification,
  Classroom,
  ContactMessage,
  CourseDocument,
  CourseRequest,
  CreditHistory,
  ExamSession,
  Lang,
  LatestReview,
  NotificationType,
  PendingTutor,
  PlatformStats,
  Role,
  Slot,
  Subject,
  SubjectPrice,
  TutorDetail,
  TutorOwnProfile,
  User,
} from '../core/api/models';
import { maskContactInfo } from './demo-masking';
import fixture from './fixture.json';

/**
 * Mode démonstration (GitHub Pages, sans serveur) : un « faux serveur » en mémoire qui reproduit
 * les règles de l'API NestJS — 12 h pour répondre, versement 24 h après le cours, remboursement
 * en crédits, coordonnées masquées dans les messages, notifications à chaque étape, décisions de
 * l'admin… — à partir de données capturées sur la vraie API (scripts/capture-demo.mjs).
 * L'état est gardé dans le navigateur (localStorage) pour survivre au rechargement.
 * Ce fichier est chargé à part (import dynamique) : il ne pèse rien hors du mode démo.
 */
type Req = CourseRequest & { jitsiRoom?: string; documents?: CourseDocument[] };
type DemoUser = User & { password: string; demoCreated?: boolean };
type DemoTutor = TutorDetail & {
  userId: string;
  status: 'valide' | 'en_attente';
  declaredAverage: number | null;
  createdAt: string;
};
type DemoSession = ExamSession & {
  bookedBy: string[];
  students: { firstName: string; school: string }[];
};
interface Person {
  firstName: string;
  school: string;
  avatarUrl: string | null;
}
interface Msg {
  id: string;
  fromRole: 'etudiant' | 'tuteur';
  body: string;
  masked: boolean;
  readAt: string | null;
  createdAt: string;
}
interface Thread {
  studentId: string;
  tutorId: string;
  messages: Msg[];
}
interface Db {
  users: DemoUser[];
  people: Record<string, Person>;
  tutors: Record<string, DemoTutor>;
  requests: Record<string, Req>;
  credits: Record<string, CreditHistory>;
  rates: Record<string, SubjectPrice[]>;
  favorites: Record<string, string[]>;
  notifications: Record<string, AppNotification[]>;
  threads: Record<string, Thread>;
  pending: PendingTutor[];
  contacts: ContactMessage[];
  sessions: DemoSession[];
  subjects: Subject[];
  reviews: LatestReview[];
  stats: PlatformStats;
}
interface Fixture {
  capturedAt: string;
  subjects: Subject[];
  stats: PlatformStats;
  latestReviews: LatestReview[];
  tutors: Record<string, TutorDetail>;
  users: User[];
  people: Record<string, Person>;
  requests: Record<string, Req>;
  classrooms: Record<string, Classroom>;
  credits: Record<string, CreditHistory>;
  tutorExtra: Record<
    string,
    { slots: Slot[]; rates: SubjectPrice[]; profile: TutorOwnProfile | null }
  >;
  favorites: Record<string, string[]>;
  notifications: Record<string, AppNotification[]>;
  threads: Record<string, Thread>;
  pending: PendingTutor[];
  contacts: ContactMessage[];
  examSessions: DemoSession[];
}

const KEY = '9rayti.demo.db.v2';
const FEE = 3000;
const H = 3_600_000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

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
  const f = shiftDates(structuredClone(fixture), shift) as unknown as Fixture;
  const requests: Record<string, Req> = {};
  for (const [id, r] of Object.entries(f.requests)) {
    const room = f.classrooms[id];
    requests[id] = {
      ...r,
      jitsiRoom: room?.jitsiRoom ?? `9rayti-${id.slice(0, 8)}`,
      documents: room?.documents ?? [],
    };
  }
  const tutors: Record<string, DemoTutor> = {};
  const rates: Record<string, SubjectPrice[]> = {};
  for (const [userId, x] of Object.entries(f.tutorExtra)) {
    rates[userId] = x.rates;
    const profileId = f.users.find((u) => u.id === userId)?.tutorProfileId;
    if (!profileId) continue;
    const pub = f.tutors[profileId];
    const p = x.profile;
    const base: TutorDetail = pub ?? {
      ...(p as TutorOwnProfile),
      declaredAverageVerified: false,
      slots: [],
      reviews: [],
    };
    tutors[profileId] = {
      ...base,
      slots: x.slots,
      userId,
      status: p?.status ?? (pub ? 'valide' : 'en_attente'),
      declaredAverage: p?.declaredAverage ?? null,
      createdAt: p?.createdAt ?? nowIso(),
    };
  }
  return {
    users: f.users.map((u) => ({ ...u, password: 'demo1234' })),
    people: f.people,
    tutors,
    requests,
    rates,
    credits: f.credits,
    favorites: f.favorites,
    notifications: f.notifications,
    threads: f.threads,
    pending: f.pending,
    contacts: f.contacts,
    sessions: f.examSessions,
    subjects: f.subjects,
    reviews: f.latestReviews,
    stats: f.stats,
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
    /* stockage indisponible ou plein */
  }
}

const ok = <T>(body: T, status = 200): Observable<HttpEvent<unknown>> =>
  of(new HttpResponse({ status, body })).pipe(delay(160));
const fail = (status: number, message: string): Observable<never> =>
  throwError(() => new HttpErrorResponse({ status, error: { statusCode: status, message } })).pipe(
    delay(160),
  ) as Observable<never>;

// ---------------------------------------------------------------- utilitaires

function userOf(req: HttpRequest<unknown>) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  return db.users.find((u) => `demo.${u.id}` === token) ?? null;
}
const balance = (id: string) =>
  (db.credits[id]?.movements ?? []).reduce((s, m) => s + m.amountMillimes, 0);
const publicUser = (u: DemoUser): User => {
  const { password: _p, demoCreated: _d, ...rest } = u;
  void _p;
  void _d;
  return { ...rest, balanceMillimes: u.role === 'etudiant' ? balance(u.id) : undefined };
};
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
    createdAt: nowIso(),
  });
  h.balanceMillimes = balance(userId);
}
const subjectParams = (s: Subject) => ({
  subjectFr: s.nameFr,
  subjectAr: s.nameAr,
  subjectEn: s.nameEn,
});
function notify(
  userId: string | undefined,
  type: NotificationType,
  params: Record<string, string | number>,
  link: string | null,
) {
  if (!userId) return;
  (db.notifications[userId] ??= []).unshift({
    id: uuid(),
    type,
    params,
    link,
    readAt: null,
    createdAt: nowIso(),
  });
}
const notifyAdmins = (
  type: NotificationType,
  params: Record<string, string | number>,
  link: string,
) => db.users.filter((u) => u.role === 'admin').forEach((a) => notify(a.id, type, params, link));
const tutorUserId = (profileId: string) =>
  db.tutors[profileId]?.userId ?? db.users.find((u) => u.tutorProfileId === profileId)?.id;
const tutorName = (r: Req) => `${r.tutor.firstName} ${r.tutor.lastInitial}`;
const person = (id: string): Person => {
  const u = db.users.find((x) => x.id === id);
  return u
    ? { firstName: u.firstName, school: u.school, avatarUrl: u.avatarUrl }
    : (db.people[id] ?? { firstName: '?', school: '', avatarUrl: null });
};
const isFree = (s: Slot) => !s.booked && +new Date(s.startsAt) > Date.now();

/** Carte de recherche, avec le score de classement de l'API (moyenne bayésienne, réactivité, expérience). */
function card(t: DemoTutor, subject?: string | null) {
  const {
    slots,
    reviews: _r,
    declaredAverageVerified: _v,
    userId: _u,
    status: _s,
    declaredAverage: _a,
    createdAt: _c,
    ...c
  } = t;
  void [_r, _v, _u, _s, _a, _c];
  const free = slots.filter(isFree).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const prices = c.subjects.map((s) => s.pricePerHourMillimes);
  const price = subject
    ? (c.subjects.find((s) => s.code === subject)?.pricePerHourMillimes ?? null)
    : prices.length
      ? Math.min(...prices)
      : null;
  const ratingSum = (c.rating ?? 4.2) * c.ratingCount;
  const score =
    (4.2 * 5 + ratingSum) / (5 + c.ratingCount) +
    1.5 * ((c.responseRate ?? 100) / 100) +
    0.5 * Math.min(Math.log10(1 + c.hoursTaught) / 2, 1);
  return {
    ...c,
    pricePerHourMillimes: price,
    nextSlot: free[0]?.startsAt ?? null,
    freeSlotCount: free.length,
    score,
  };
}
const validTutors = () => Object.values(db.tutors).filter((t) => t.status === 'valide');

function hasSlotWhen(slots: Slot[], when: string): boolean {
  const now = Date.now();
  const week = now + 7 * 24 * H;
  return slots.some((s) => {
    const t = +new Date(s.startsAt);
    if (s.booked || t < now) return false;
    if (when === 'semaine') return t <= week;
    const local = new Date(t + H); // heure de Tunis (UTC+1)
    if (when === 'soir') return t <= now + 24 * H && local.getUTCHours() >= 17;
    const day = local.getUTCDay();
    return t <= week && (day === 0 || day === 6);
  });
}

/** Expiration après 12 h, versement 24 h après le cours, annulation des sessions incomplètes. */
function sweep(): void {
  const now = Date.now();
  for (const r of Object.values(db.requests)) {
    if (r.state === 'en_attente' && +new Date(r.expiresAt) <= now) {
      refund(r, 'expiree');
      notify(
        r.student.id,
        'demande_expiree',
        { from: tutorName(r), ...subjectParams(r.subject) },
        '/mon-espace?onglet=credits',
      );
    }
    if (r.state === 'faite' && r.payoutAt && +new Date(r.payoutAt) <= now) payout(r);
  }
  for (const s of db.sessions) {
    if (s.status === 'annulee' || +new Date(s.startsAt) > now || s.placesTaken >= s.placesMin)
      continue;
    s.status = 'annulee';
    for (const id of s.bookedBy) {
      move(id, s.pricePerPlaceMillimes, 'remboursement', `Session annulée : ${s.subject.nameFr}`);
      notify(id, 'session_annulee', subjectParams(s.subject), '/mon-espace?onglet=credits');
    }
  }
}
function payout(r: Req): void {
  r.state = 'versee';
  r.canReport = false;
  notify(
    tutorUserId(r.tutor.id),
    'versement',
    { from: r.student.firstName, amount: r.amountMillimes, ...subjectParams(r.subject) },
    '/espace-tuteur?onglet=revenus',
  );
}
function refund(r: Req, state: Req['state']): void {
  r.state = state;
  const slot = db.tutors[r.tutor.id]?.slots.find((s) => s.startsAt === r.startsAt);
  if (slot && ['refusee', 'expiree', 'annulee'].includes(state)) slot.booked = false;
  if (r.payWith === 'credits' || state === 'remboursee')
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
  canReview:
    u.role === 'etudiant' && ['faite', 'versee', 'signalee'].includes(r.state) && !r.review,
  canReport:
    u.role === 'etudiant' &&
    r.state === 'faite' &&
    !!r.payoutAt &&
    +new Date(r.payoutAt) > Date.now(),
});
const msgView = (m: Msg, role: Role) => ({
  id: m.id,
  body: m.body,
  masked: m.masked,
  mine: m.fromRole === role,
  readAt: m.readAt,
  createdAt: m.createdAt,
});
const sessionView = (s: DemoSession, u: User | null) => {
  const { bookedBy, students, ...rest } = s;
  const own = !!u && u.tutorProfileId === s.tutor.id;
  return { ...rest, booked: !!u && bookedBy.includes(u.id), ...(own ? { students } : {}) };
};
function revenue(profileId: string) {
  const list = Object.values(db.requests)
    .filter((r) => r.tutor.id === profileId && ['faite', 'versee', 'signalee'].includes(r.state))
    .sort((a, b) => +new Date(b.doneAt ?? b.startsAt) - +new Date(a.doneAt ?? a.startsAt));
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monday);
    start.setDate(start.getDate() - (11 - i) * 7);
    return { weekStart: start.toISOString(), paidMillimes: 0, pendingMillimes: 0, courses: 0 };
  });
  for (const r of list) {
    const when = new Date(r.doneAt ?? r.startsAt);
    const idx = weeks.findIndex(
      (w, i) =>
        when >= new Date(w.weekStart) && (i === 11 || when < new Date(weeks[i + 1].weekStart)),
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
        .map((r) => r.payoutAt!)
        .sort()[0] ?? null,
    payouts: list,
  };
}
function stats(): PlatformStats {
  const tutors = validTutors();
  const courses = Object.values(db.requests).filter((r) =>
    ['faite', 'versee'].includes(r.state),
  ).length;
  return {
    ...db.stats,
    tutors: tutors.length,
    subjects: db.subjects.length,
    students:
      db.stats.students + db.users.filter((u) => u.demoCreated && u.role === 'etudiant').length,
    courses: Math.max(courses, db.stats.courses),
    hoursTaught: tutors.reduce((s, t) => s + t.hoursTaught, 0),
  };
}

// ---------------------------------------------------------------- routes

export function demoInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
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

  // ----- Comptes
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
    const id = uuid();
    const tutor = body['role'] === 'tuteur';
    const nu: DemoUser = {
      id,
      email,
      password: String(body['password']),
      role: body['role'] as User['role'],
      firstName: String(body['firstName']),
      lastName: String(body['lastName']),
      school: String(body['school']),
      year: String(body['year']),
      lang: (body['lang'] as Lang) ?? 'fr',
      tutorStatus: tutor ? 'en_attente' : null,
      tutorProfileId: tutor ? uuid() : null,
      avatarUrl: null,
      createdAt: nowIso(),
      demoCreated: true,
    };
    db.users.push(nu);
    if (tutor) {
      const subs = (body['subjects'] as { code: string; pricePerHourDt: number }[]) ?? [];
      db.rates[id] = subs.map((s) => ({
        ...db.subjects.find((x) => x.code === s.code)!,
        pricePerHourMillimes: s.pricePerHourDt * 1000,
      }));
      const subjects = db.rates[id].map(
        ({ code, nameFr, nameAr, nameEn, pricePerHourMillimes }) => ({
          code,
          nameFr,
          nameAr,
          nameEn,
          pricePerHourMillimes,
        }),
      );
      db.tutors[nu.tutorProfileId!] = {
        id: nu.tutorProfileId!,
        userId: id,
        status: 'en_attente',
        declaredAverage: Number(body['declaredAverage'] ?? 0) || null,
        createdAt: nowIso(),
        firstName: nu.firstName,
        lastInitial: `${nu.lastName.charAt(0)}.`,
        avatarUrl: null,
        school: nu.school,
        year: nu.year,
        bio: String(body['bio'] ?? ''),
        languages: [nu.lang],
        rating: null,
        ratingCount: 0,
        isNew: true,
        hoursTaught: 0,
        responseRate: null,
        subjects,
        pricePerHourMillimes: null,
        nextSlot: null,
        freeSlotCount: 0,
        declaredAverageVerified: false,
        slots: [],
        reviews: [],
      };
      db.pending.push({
        id: nu.tutorProfileId!,
        name: `${nu.firstName} ${nu.lastName}`,
        email,
        school: nu.school,
        year: nu.year,
        declaredAverage: Number(body['declaredAverage'] ?? 0) || null,
        subjects: subjects.map((r) => r.nameFr),
        createdAt: nowIso(),
      });
    } else db.credits[id] = { balanceMillimes: 0, movements: [] };
    return done({ token: `demo.${id}`, user: publicUser(nu) }, 201);
  }

  // ----- Catalogue et contenus publics
  if (m === 'GET' && path === '/subjects') return ok(db.subjects);
  if (m === 'GET' && path === '/stats') return ok(stats());
  if (m === 'GET' && path === '/reviews/latest') return ok(db.reviews.slice(0, 8));
  if (m === 'POST' && path === '/contact') {
    const name = String(body['name'] ?? '').trim();
    const message = String(body['message'] ?? '').trim();
    if (name.length < 2 || message.length < 10) return fail(400, 'Nom ou message trop court');
    db.contacts.unshift({
      id: Date.now(),
      name,
      email: String(body['email']),
      topic: body['topic'] as ContactMessage['topic'],
      message,
      status: 'nouveau',
      createdAt: nowIso(),
    });
    notifyAdmins('contact', { from: name }, '/admin?onglet=contact');
    return done({ ok: true }, 201);
  }
  if (m === 'GET' && path === '/tutors') {
    const p = req.params;
    const subject = p.get('subject');
    const maxPrice = Number(p.get('maxPrice') ?? 0);
    const minRating = Number(p.get('minRating') ?? 0);
    const lang = p.get('lang');
    const when = p.get('when');
    const sort = p.get('sort') ?? 'pertinence';
    let list = validTutors()
      .filter((t) => !when || hasSlotWhen(t.slots, when))
      .map((t) => card(t, subject));
    if (subject) list = list.filter((c) => c.subjects.some((s) => s.code === subject));
    if (maxPrice) list = list.filter((c) => (c.pricePerHourMillimes ?? 0) <= maxPrice * 1000);
    if (minRating) list = list.filter((c) => (c.rating ?? 0) >= minRating);
    if (lang) list = list.filter((c) => c.languages.includes(lang as Lang));
    list.sort((a, b) =>
      sort === 'prix'
        ? (a.pricePerHourMillimes ?? 0) - (b.pricePerHourMillimes ?? 0)
        : sort === 'note'
          ? (b.rating ?? 0) - (a.rating ?? 0)
          : b.score - a.score,
    );
    return ok(list);
  }
  if (m === 'GET' && seg[0] === 'tutors' && seg[1]) {
    const t = db.tutors[seg[1]];
    if (!t || t.status !== 'valide')
      return fail(404, 'Ce tuteur n’existe pas ou n’est pas encore validé');
    return ok({
      ...card(t),
      declaredAverageVerified: t.declaredAverageVerified,
      reviews: t.reviews,
      slots: t.slots.filter((s) => +new Date(s.startsAt) > Date.now()).slice(0, 24),
    });
  }
  if (m === 'GET' && path === '/exam-sessions') {
    const subject = req.params.get('subject');
    return ok(
      db.sessions
        .filter(
          (s) =>
            s.status !== 'annulee' &&
            +new Date(s.startsAt) > Date.now() &&
            (!subject || s.subject.code === subject),
        )
        .map((s) => sessionView(s, null)),
    );
  }
  if (m === 'GET' && seg[0] === 'exam-sessions' && seg[1] && seg[1] !== 'mine') {
    const s = db.sessions.find((x) => x.id === seg[1]);
    if (!s) return fail(404, 'Session introuvable');
    if (seg[2] === 'me' && !u) return fail(401, 'Connexion requise');
    return ok(sessionView(s, seg[2] === 'me' ? u : null));
  }

  // ----- Tout le reste demande une session
  if (!u) return fail(401, 'Connexion requise');
  const profileId = u.tutorProfileId;
  const me = profileId ? db.tutors[profileId] : undefined;

  if (path === '/auth/me' && m === 'GET') return ok(publicUser(u));
  if (path === '/auth/me' && m === 'PATCH') {
    for (const k of ['firstName', 'lastName', 'school', 'year'] as const)
      if (typeof body[k] === 'string' && body[k]) u[k] = String(body[k]).trim();
    if (me)
      Object.assign(me, {
        firstName: u.firstName,
        lastInitial: `${u.lastName.charAt(0)}.`,
        school: u.school,
        year: u.year,
      });
    return done(publicUser(u));
  }
  if (m === 'PATCH' && path === '/auth/me/lang') {
    u.lang = body['lang'] as Lang;
    return done(publicUser(u));
  }
  if (m === 'POST' && path === '/auth/me/password') {
    if (body['currentPassword'] !== u.password) return fail(400, 'Mot de passe actuel incorrect');
    u.password = String(body['newPassword']);
    return done({ ok: true }, 201);
  }
  if (path === '/auth/me/avatar') {
    u.avatarUrl = m === 'PUT' ? String(body['dataUrl']) : null;
    if (me) me.avatarUrl = u.avatarUrl;
    return done(publicUser(u));
  }
  if (m === 'GET' && path === '/credits/me')
    return ok({ ...(db.credits[u.id] ?? { movements: [] }), balanceMillimes: balance(u.id) });
  if (m === 'POST' && path === '/credits/recharge') {
    move(u.id, Number(body['amountDt']) * 1000, 'recharge', 'Recharge par carte (simulée)');
    return done({ ...db.credits[u.id], balanceMillimes: balance(u.id) }, 201);
  }

  // ----- Sessions d'examen (étudiant)
  if (m === 'GET' && path === '/exam-sessions/mine')
    return ok(db.sessions.filter((s) => s.bookedBy.includes(u.id)).map((s) => sessionView(s, u)));
  if (m === 'POST' && seg[0] === 'exam-sessions' && seg[2] === 'book') {
    const s = db.sessions.find((x) => x.id === seg[1]);
    if (!s) return fail(404, 'Session introuvable');
    if (s.status === 'annulee' || +new Date(s.startsAt) <= Date.now())
      return fail(400, 'Cette session n’est plus ouverte');
    if (s.bookedBy.includes(u.id)) return fail(409, 'Tu as déjà une place');
    if (s.placesTaken >= s.placesMax) return fail(409, 'Plus de place dans cette session');
    if (balance(u.id) < s.pricePerPlaceMillimes)
      return fail(400, 'Solde de crédits insuffisant : recharge ton compte.');
    move(u.id, -s.pricePerPlaceMillimes, 'paiement', `Session d’examen : ${s.subject.nameFr}`);
    s.bookedBy.push(u.id);
    s.students.push({ firstName: u.firstName, school: u.school });
    s.placesTaken++;
    s.confirmed = s.placesTaken >= s.placesMin;
    notify(
      tutorUserId(s.tutor.id),
      'session_reservee',
      { ...subjectParams(s.subject), taken: s.placesTaken, max: s.placesMax },
      '/espace-tuteur?onglet=sessions',
    );
    return done(sessionView(s, u), 201);
  }

  // ----- Favoris
  if (seg[0] === 'favorites') {
    const ids = (db.favorites[u.id] ??= []);
    if (m === 'GET' && seg[1] === 'ids') return ok(ids);
    if (m === 'GET')
      return ok(
        ids
          .map((id) => db.tutors[id])
          .filter((t) => t?.status === 'valide')
          .map((t) => card(t)),
      );
    if (seg[1] && m === 'PUT' && !ids.includes(seg[1])) ids.push(seg[1]);
    if (seg[1] && m === 'DELETE') db.favorites[u.id] = ids.filter((x) => x !== seg[1]);
    return done(db.favorites[u.id]);
  }

  // ----- Messages
  if (seg[0] === 'messages') {
    if (u.role !== 'etudiant' && u.role !== 'tuteur')
      return fail(403, 'Réservé aux étudiants et aux tuteurs');
    const key = (partnerId: string) =>
      u.role === 'etudiant' ? `${u.id}|${partnerId}` : `${partnerId}|${profileId}`;
    const partnerOf = (t: Thread) => {
      if (u.role === 'tuteur') {
        const p = person(t.studentId);
        return {
          id: t.studentId,
          name: p.firstName,
          school: p.school,
          avatarUrl: p.avatarUrl,
          role: 'etudiant' as const,
        };
      }
      const tu = db.tutors[t.tutorId];
      return {
        id: t.tutorId,
        name: `${tu?.firstName ?? '?'} ${tu?.lastInitial ?? ''}`,
        school: tu?.school ?? '',
        avatarUrl: tu?.avatarUrl ?? null,
        role: 'tuteur' as const,
      };
    };
    const canWrite = (t: Thread) =>
      u.role === 'etudiant'
        ? db.tutors[t.tutorId]?.status === 'valide'
        : t.messages.some((x) => x.fromRole === 'etudiant') ||
          Object.values(db.requests).some(
            (r) => r.student.id === t.studentId && r.tutor.id === t.tutorId,
          );
    if (m === 'GET' && !seg[1]) {
      const mine = Object.values(db.threads).filter(
        (t) =>
          (u.role === 'etudiant' ? t.studentId === u.id : t.tutorId === profileId) &&
          t.messages.length,
      );
      return ok(
        mine
          .map((t) => ({
            partner: partnerOf(t),
            last: msgView(t.messages[t.messages.length - 1], u.role),
            unread: t.messages.filter((x) => x.fromRole !== u.role && !x.readAt).length,
          }))
          .sort((a, b) => +new Date(b.last.createdAt) - +new Date(a.last.createdAt)),
      );
    }
    const partnerId = seg[1];
    if (u.role === 'etudiant' && !db.tutors[partnerId]) return fail(404, 'Tuteur introuvable');
    if (u.role === 'tuteur' && !db.users.some((x) => x.id === partnerId) && !db.people[partnerId])
      return fail(404, 'Étudiant introuvable');
    const k = key(partnerId);
    const t: Thread = db.threads[k] ?? {
      studentId: u.role === 'etudiant' ? u.id : partnerId,
      tutorId: u.role === 'etudiant' ? partnerId : profileId!,
      messages: [],
    };
    if (m === 'GET') {
      for (const x of t.messages) if (x.fromRole !== u.role && !x.readAt) x.readAt = nowIso();
      if (db.threads[k]) save();
      return ok({
        partner: partnerOf(t),
        canWrite: canWrite(t),
        messages: t.messages.slice(-300).map((x) => msgView(x, u.role)),
      });
    }
    if (m === 'POST') {
      const raw = String(body['body'] ?? '').trim();
      if (!raw) return fail(400, 'Message vide');
      if (!canWrite(t))
        return fail(
          403,
          'Le tuteur peut répondre, mais ne peut pas écrire en premier à un étudiant',
        );
      const lastHour = t.messages.filter(
        (x) => x.fromRole === u.role && +new Date(x.createdAt) > Date.now() - H,
      ).length;
      if (lastHour >= 60) return fail(429, 'Trop de messages en une heure, réessaie plus tard');
      const { text, masked } = maskContactInfo(raw);
      const msg: Msg = {
        id: uuid(),
        fromRole: u.role as 'etudiant' | 'tuteur',
        body: text,
        masked,
        readAt: null,
        createdAt: nowIso(),
      };
      t.messages.push(msg);
      db.threads[k] = t;
      const recipient = u.role === 'tuteur' ? t.studentId : tutorUserId(t.tutorId);
      const recipientPartnerId = u.role === 'tuteur' ? t.tutorId : t.studentId;
      notify(recipient, 'message', { from: u.firstName }, `/messages/${recipientPartnerId}`);
      return done(msgView(msg, u.role), 201);
    }
  }

  // ----- Notifications
  if (seg[0] === 'notifications') {
    const list = (db.notifications[u.id] ??= []);
    if (m === 'POST') {
      for (const n of list) if (!seg[2] || n.id === seg[1]) n.readAt ??= nowIso();
      save();
    }
    return ok({ unread: list.filter((n) => !n.readAt).length, items: list.slice(0, 30) });
  }

  // ----- Demandes de cours
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
    if (u.role !== 'etudiant') return fail(403, 'Seuls les comptes étudiants peuvent réserver');
    const t = db.tutors[String(body['tutorId'])];
    const slot = t?.slots.find((s) => s.id === Number(body['slotId']));
    const subj = t?.subjects.find((s) => s.code === body['subjectCode']);
    if (!t || t.status !== 'valide' || !slot || !subj)
      return fail(400, 'Créneau ou matière invalide');
    if (slot.booked) return fail(409, 'Cette heure vient d’être prise : choisis-en une autre');
    const amount = Math.round((subj.pricePerHourMillimes * slot.durationMin) / 60);
    const total = amount + FEE;
    if (body['payWith'] === 'credits' && balance(u.id) < total)
      return fail(400, 'Solde de crédits insuffisant : recharge ou paie par carte.');
    const id = uuid();
    slot.booked = true;
    const r: Req = {
      id,
      state: 'en_attente',
      subject: db.subjects.find((s) => s.code === subj.code)!,
      startsAt: slot.startsAt,
      durationMin: slot.durationMin,
      amountMillimes: amount,
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
      resolutionNote: null,
      recap: null,
      createdAt: nowIso(),
      student: { id: u.id, firstName: u.firstName, school: u.school, avatarUrl: u.avatarUrl },
      tutor: {
        id: t.id,
        firstName: t.firstName,
        lastInitial: t.lastInitial,
        avatarUrl: t.avatarUrl,
      },
      review: null,
      canReview: false,
      canReport: false,
      jitsiRoom: `9rayti-${id.slice(0, 8)}`,
      documents: [],
    };
    if (r.payWith === 'credits') move(u.id, -total, 'paiement', `Cours de ${r.subject.nameFr}`, id);
    db.requests[id] = r;
    notify(
      t.userId,
      'demande_recue',
      { from: u.firstName, ...subjectParams(r.subject) },
      '/espace-tuteur',
    );
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
    const params = (from: string, more: Record<string, string | number> = {}) => ({
      from,
      ...subjectParams(r.subject),
      ...more,
    });
    switch (seg[2]) {
      case 'cancel': {
        const e = need(['en_attente'], 'annuler');
        if (e) return e;
        refund(r, 'annulee');
        notify(t?.userId, 'cours_annule', params(r.student.firstName), '/espace-tuteur');
        break;
      }
      case 'accept': {
        const e = need(['en_attente'], 'accepter');
        if (e) return e;
        r.state = 'acceptee';
        r.answeredAt = nowIso();
        notify(r.student.id, 'demande_acceptee', params(tutorName(r)), `/salle/${r.id}`);
        break;
      }
      case 'refuse': {
        const e = need(['en_attente'], 'refuser');
        if (e) return e;
        r.answeredAt = nowIso();
        refund(r, 'refusee');
        notify(r.student.id, 'demande_refusee', params(tutorName(r)), '/mon-espace?onglet=credits');
        break;
      }
      case 'tutor-cancel': {
        const e = need(['acceptee'], 'annuler_tuteur');
        if (e) return e;
        refund(r, 'annulee_tuteur');
        notify(r.student.id, 'cours_annule', params(tutorName(r)), '/mon-espace?onglet=credits');
        break;
      }
      case 'complete': {
        const e = need(['acceptee'], 'terminer');
        if (e) return e;
        r.state = 'faite';
        r.recap = String(body['recap'] ?? '').trim() || null;
        r.doneAt = nowIso();
        r.payoutAt = new Date(Date.now() + 24 * H).toISOString();
        if (t) t.hoursTaught += Math.round(r.durationMin / 60);
        notify(r.student.id, 'cours_termine', params(tutorName(r)), '/mon-espace');
        break;
      }
      case 'report': {
        const e = need(['faite'], 'signaler');
        if (e) return e;
        if (!r.payoutAt || +new Date(r.payoutAt) <= Date.now())
          return fail(400, 'Le délai de 24 h pour signaler est dépassé');
        r.state = 'signalee';
        r.reportReason = String(body['reason']);
        notify(
          t?.userId,
          'signalement',
          params(r.student.firstName),
          '/espace-tuteur?onglet=cours',
        );
        notifyAdmins('signalement', params(r.student.firstName), '/admin?onglet=signalements');
        break;
      }
      case 'review': {
        if (!['faite', 'versee', 'signalee'].includes(r.state))
          return fail(400, 'Tu pourras noter le cours une fois qu’il aura eu lieu');
        if (r.review) return fail(409, 'Tu as déjà noté ce cours');
        r.review = {
          rating: Number(body['rating']),
          comment: String(body['comment'] ?? '').trim(),
        };
        if (t) {
          t.reviews.unshift({
            author: u.firstName,
            authorAvatarUrl: u.avatarUrl,
            subject: r.subject,
            rating: r.review.rating,
            comment: r.review.comment,
            date: nowIso(),
          });
          const sum = (t.rating ?? 4.5) * t.ratingCount + r.review.rating;
          t.ratingCount++;
          t.rating = Math.round((sum / t.ratingCount) * 10) / 10;
          t.isNew = t.ratingCount < 5;
          if (r.review.rating >= 4 && r.review.comment)
            db.reviews.unshift({
              author: u.firstName,
              school: u.school,
              authorAvatarUrl: u.avatarUrl,
              tutor: { id: t.id, name: `${t.firstName} ${t.lastInitial}` },
              subject: r.subject,
              rating: r.review.rating,
              comment: r.review.comment,
              date: nowIso(),
            });
        }
        notify(
          t?.userId,
          'avis_recu',
          params(u.firstName, { rating: r.review.rating }),
          `/tuteurs/${r.tutor.id}`,
        );
        return done(viewFor(r, u), 201);
      }
      default:
        return fail(404, 'Route inconnue');
    }
    return done(viewFor(r, u));
  }

  // ----- Salle de cours
  if (seg[0] === 'classroom' && seg[1]) {
    const r = db.requests[seg[1]];
    if (!r || !(r.student.id === u.id || r.tutor.id === profileId))
      return fail(403, 'Cette salle ne te concerne pas');
    if (!['acceptee', 'faite', 'versee', 'signalee', 'remboursee'].includes(r.state))
      return fail(403, 'La salle ouvre quand le tuteur a accepté la demande');
    if (m === 'POST' && seg[2] === 'documents') {
      if (r.tutor.id !== profileId) return fail(403, 'Seul le tuteur ajoute des documents');
      const doc: CourseDocument = {
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

  // ----- Espace tuteur
  if (seg[0] === 'tutor') {
    if (u.role !== 'tuteur' || !me) return fail(403, 'Réservé aux tuteurs');
    const mine = all.filter((r) => r.tutor.id === profileId);
    if (path === '/tutor/dashboard') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const nextCourse =
        mine
          .filter((r) => r.state === 'acceptee' && +new Date(r.startsAt) > Date.now() - 2 * H)
          .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0] ?? null;
      return ok({
        status: me.status,
        earnedThisMonthMillimes: mine
          .filter((r) => r.state === 'versee' && r.doneAt && new Date(r.doneAt) >= monthStart)
          .reduce((s, r) => s + r.amountMillimes, 0),
        pendingPayoutMillimes: mine
          .filter((r) => r.state === 'faite')
          .reduce((s, r) => s + r.amountMillimes, 0),
        responseRate: me.responseRate,
        rating: me.rating,
        ratingCount: me.ratingCount,
        hoursTaught: me.hoursTaught,
        nextCourse,
        pendingRequests: mine.filter((r) => r.state === 'en_attente').length,
      });
    }
    if (path === '/tutor/revenue') return ok(revenue(profileId!));
    if (path === '/tutor/profile') {
      if (m === 'PATCH') {
        if (typeof body['bio'] === 'string') me.bio = String(body['bio']).trim();
        if (Array.isArray(body['languages']))
          me.languages = [...new Set(body['languages'] as Lang[])];
        save();
      }
      return ok({
        ...card(me),
        status: me.status,
        declaredAverage: me.declaredAverage,
        createdAt: me.createdAt,
      });
    }
    if (path === '/tutor/slots') {
      if (m === 'GET')
        return ok(me.slots.filter((s) => +new Date(s.startsAt) > Date.now() - 24 * H));
      const startsAt = new Date(String(body['startsAt'])).toISOString();
      if (+new Date(startsAt) <= Date.now()) return fail(400, 'Choisis une heure dans le futur');
      if (me.slots.some((s) => s.startsAt === startsAt))
        return fail(400, 'Tu as déjà une heure libre à ce moment');
      const slot: Slot = {
        id: Date.now(),
        startsAt,
        durationMin: Number(body['durationMin']),
        booked: false,
      };
      me.slots = [...me.slots, slot].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      return done(slot, 201);
    }
    if (m === 'DELETE' && seg[1] === 'slots') {
      const s = me.slots.find((x) => x.id === Number(seg[2]));
      if (!s) return fail(404, 'Heure introuvable');
      if (s.booked) return fail(400, 'Cette heure est déjà réservée');
      me.slots = me.slots.filter((x) => x !== s);
      return done(null);
    }
    if (path === '/tutor/rates') {
      if (m === 'GET') return ok(db.rates[u.id] ?? []);
      const code = String(body['subjectCode']);
      const price = Number(body['pricePerHourDt']) * 1000;
      const subj = db.subjects.find((s) => s.code === code);
      if (!subj) return fail(400, 'Matière inconnue');
      const list = (db.rates[u.id] ??= []);
      const existing = list.find((r) => r.code === code);
      if (existing) existing.pricePerHourMillimes = price;
      else
        list.push({
          code,
          nameFr: subj.nameFr,
          nameAr: subj.nameAr,
          nameEn: subj.nameEn,
          pricePerHourMillimes: price,
        });
      me.subjects = list.map(({ code: c, nameFr, nameAr, nameEn, pricePerHourMillimes }) => ({
        code: c,
        nameFr,
        nameAr,
        nameEn,
        pricePerHourMillimes,
      }));
      return done({ code, pricePerHourMillimes: price });
    }
    if (path === '/tutor/exam-sessions') {
      if (m === 'GET')
        return ok(
          db.sessions.filter((s) => s.tutor.id === profileId).map((s) => sessionView(s, u)),
        );
      if (me.status !== 'valide')
        return fail(403, 'Ton profil doit être validé pour publier une session');
      const subj = db.subjects.find((s) => s.code === body['subjectCode']);
      const startsAt = new Date(String(body['startsAt']));
      const placesMin = Number(body['placesMin']);
      const placesMax = Number(body['placesMax']);
      if (!subj) return fail(400, 'Matière inconnue');
      if (+startsAt <= Date.now() + 2 * H)
        return fail(400, 'La session doit commencer dans plus de 2 h');
      if (placesMin > placesMax) return fail(400, 'Le minimum dépasse le nombre de places');
      const s: DemoSession = {
        id: uuid(),
        subject: subj,
        tutor: {
          id: me.id,
          firstName: me.firstName,
          lastInitial: me.lastInitial,
          school: me.school,
          avatarUrl: me.avatarUrl,
        },
        startsAt: startsAt.toISOString(),
        durationMin: Number(body['durationMin']),
        placesMin,
        placesMax,
        placesTaken: 0,
        pricePerPlaceMillimes: Math.round(Number(body['pricePerPlaceDt']) * 1000),
        confirmed: false,
        booked: false,
        status: 'ouverte',
        description: String(body['description'] ?? ''),
        bookedBy: [],
        students: [],
      };
      db.sessions.push(s);
      return done(sessionView(s, u), 201);
    }
  }

  // ----- Administration
  if (seg[0] === 'admin') {
    if (u.role !== 'admin') return fail(403, 'Réservé à l’administration');
    if (path === '/admin/overview') {
      const by = new Map<string, { state: Req['state']; count: number; volumeMillimes: number }>();
      for (const r of all) {
        const x = by.get(r.state) ?? { state: r.state, count: 0, volumeMillimes: 0 };
        x.count++;
        x.volumeMillimes += r.totalMillimes;
        by.set(r.state, x);
      }
      return ok({
        tutors: { validated: validTutors().length, pending: db.pending.length },
        reports: all.filter((r) => r.state === 'signalee').length,
        contacts: db.contacts.filter((c) => c.status === 'nouveau').length,
        requests: [...by.values()],
      });
    }
    if (path === '/admin/tutors/pending') return ok(db.pending);
    if (seg[1] === 'tutors' && seg[3] === 'validate') {
      db.pending = db.pending.filter((p) => p.id !== seg[2]);
      const t = db.tutors[seg[2]];
      const tu = db.users.find((x) => x.tutorProfileId === seg[2]);
      if (t) t.status = 'valide';
      if (tu) tu.tutorStatus = 'valide';
      notify(tu?.id, 'tuteur_valide', { from: '9rayti' }, '/espace-tuteur');
      return done({ id: seg[2], status: 'valide' }, 201);
    }
    if (path === '/admin/reports')
      return ok(
        all
          .filter((r) => r.state === 'signalee')
          .sort((a, b) => +new Date(a.doneAt ?? 0) - +new Date(b.doneAt ?? 0)),
      );
    if (seg[1] === 'reports' && seg[3] === 'resolve') {
      const r = db.requests[seg[2]];
      if (!r || r.state !== 'signalee') return fail(400, 'Ce cours n’est pas signalé');
      const decision = body['decision'] === 'verser' ? 'verser' : 'rembourser';
      r.resolutionNote = String(body['note'] ?? '').trim() || null;
      const tid = tutorUserId(r.tutor.id);
      if (decision === 'rembourser') {
        refund(r, 'remboursee');
        notify(
          r.student.id,
          'signalement_traite',
          { from: tutorName(r), ...subjectParams(r.subject), decision },
          '/mon-espace?onglet=credits',
        );
        notify(
          tid,
          'signalement_traite',
          { from: r.student.firstName, ...subjectParams(r.subject), decision },
          '/espace-tuteur?onglet=revenus',
        );
      } else {
        notify(
          r.student.id,
          'signalement_traite',
          { from: tutorName(r), ...subjectParams(r.subject), decision },
          '/mon-espace',
        );
        payout(r);
      }
      return done(r, 201);
    }
    if (path === '/admin/requests') {
      const state = req.params.get('state');
      const q = (req.params.get('search') ?? '').toLowerCase();
      const page = Math.max(1, Number(req.params.get('page') ?? 1));
      const list = all
        .filter((r) => !state || r.state === state)
        .filter(
          (r) =>
            !q ||
            [r.student.firstName, r.tutor.firstName, r.subject.nameFr].some((x) =>
              x.toLowerCase().includes(q),
            ),
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      return ok({
        total: list.length,
        page,
        pages: Math.max(1, Math.ceil(list.length / 20)),
        items: list.slice((page - 1) * 20, page * 20),
      });
    }
    if (path === '/admin/subjects') {
      if (m === 'GET') {
        return ok(
          [...db.subjects]
            .sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'))
            .map((s) => ({
              ...s,
              tutors: Object.values(db.rates).filter((list) => list.some((r) => r.code === s.code))
                .length,
            })),
        );
      }
      const code = String(body['code'] ?? '').trim();
      if (db.subjects.some((s) => s.code === code))
        return fail(409, 'Ce code de matière existe déjà');
      const s: Subject = {
        id: Math.max(0, ...db.subjects.map((x) => x.id)) + 1,
        code,
        nameFr: String(body['nameFr']),
        nameAr: String(body['nameAr']),
        nameEn: String(body['nameEn']),
      };
      db.subjects.push(s);
      return done(s, 201);
    }
    if (seg[1] === 'subjects' && seg[2] && m === 'PATCH') {
      const s = db.subjects.find((x) => x.id === Number(seg[2]));
      if (!s) return fail(404, 'Matière introuvable');
      for (const k of ['nameFr', 'nameAr', 'nameEn'] as const)
        if (typeof body[k] === 'string' && body[k]) s[k] = String(body[k]);
      return done(s);
    }
    if (path === '/admin/contact') return ok(db.contacts.slice(0, 100));
    if (seg[1] === 'contact' && seg[2] && m === 'PATCH') {
      const c = db.contacts.find((x) => x.id === Number(seg[2]));
      if (c) c.status = body['status'] === 'traite' ? 'traite' : 'nouveau';
      return done(db.contacts.slice(0, 100));
    }
  }
  return fail(404, 'Route inconnue en mode démo');
}

/** Remet la démo à zéro (bouton « Réinitialiser la démo »). */
export function resetDemo(): void {
  db = fresh();
  save();
}

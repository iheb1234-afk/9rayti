/** Types partagés avec l'API (montants en millimes : 1 DT = 1000). */
export type Role = 'etudiant' | 'tuteur' | 'admin';
export type Lang = 'fr' | 'ar' | 'en';
export type RequestState =
  | 'en_attente'
  | 'acceptee'
  | 'faite'
  | 'versee'
  | 'signalee'
  | 'remboursee'
  | 'refusee'
  | 'expiree'
  | 'annulee'
  | 'annulee_tuteur';

export interface Subject {
  id: number;
  code: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  school: string;
  year: string;
  lang: Lang;
  tutorStatus: 'en_attente' | 'valide' | null;
  tutorProfileId: string | null;
  /** Chemin relatif à l'API (« /users/…/avatar?v=2 »), ou null : voir ApiService.asset(). */
  avatarUrl: string | null;
  createdAt?: string;
  balanceMillimes?: number;
}
export interface Session {
  token: string;
  user: User;
}

export interface SubjectPrice {
  code: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  pricePerHourMillimes: number;
}
export interface TutorCard {
  id: string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  school: string;
  year: string;
  bio: string;
  languages: Lang[];
  rating: number | null;
  ratingCount: number;
  isNew: boolean;
  hoursTaught: number;
  responseRate: number | null;
  subjects: SubjectPrice[];
  pricePerHourMillimes: number | null;
  nextSlot: string | null;
  freeSlotCount: number;
}
export interface Slot {
  id: number;
  startsAt: string;
  durationMin: number;
  booked: boolean;
}
export interface ReviewView {
  author: string;
  authorAvatarUrl?: string | null;
  subject: Subject;
  rating: number;
  comment: string;
  date: string;
}
export interface TutorDetail extends TutorCard {
  declaredAverageVerified: boolean;
  slots: Slot[];
  reviews: ReviewView[];
}
/** Profil du tuteur connecté, visible même avant sa validation. */
export interface TutorOwnProfile extends TutorCard {
  status: 'en_attente' | 'valide';
  declaredAverage: number | null;
  createdAt: string;
}

export interface Person {
  id: string;
  firstName: string;
  avatarUrl?: string | null;
}
export interface CourseRequest {
  id: string;
  state: RequestState;
  subject: Subject;
  startsAt: string;
  durationMin: number;
  amountMillimes: number;
  feeMillimes: number;
  totalMillimes: number;
  payWith: 'credits' | 'carte';
  attachmentName: string | null;
  message: string;
  expiresAt: string;
  answeredAt: string | null;
  doneAt: string | null;
  payoutAt: string | null;
  reportReason: string | null;
  resolutionNote?: string | null;
  recap?: string | null;
  createdAt: string;
  student: Person & { school: string };
  tutor: Person & { lastInitial: string };
  review: { rating: number; comment: string } | null;
  canReview: boolean;
  canReport: boolean;
}
export interface CourseDocument {
  id: number;
  kind: 'pdf' | 'replay';
  name: string;
  url: string;
}
export interface Classroom extends CourseRequest {
  role: Role;
  jitsiRoom: string;
  jitsiUrl: string;
  documents: CourseDocument[];
}

export interface CreditMovement {
  id: number;
  amountMillimes: number;
  reason: 'recharge' | 'paiement' | 'remboursement';
  label: string;
  requestId: string | null;
  createdAt: string;
}
export interface CreditHistory {
  balanceMillimes: number;
  movements: CreditMovement[];
}

export interface TutorDashboard {
  earnedThisMonthMillimes: number;
  pendingPayoutMillimes: number;
  responseRate: number | null;
  rating: number | null;
  ratingCount: number;
  hoursTaught: number;
  status: 'en_attente' | 'valide';
  nextCourse: CourseRequest | null;
  pendingRequests: number;
}
export interface RevenueWeek {
  weekStart: string;
  paidMillimes: number;
  pendingMillimes: number;
  courses: number;
}
export interface Revenue {
  weeks: RevenueWeek[];
  totalPaidMillimes: number;
  pendingMillimes: number;
  nextPayoutAt: string | null;
  payouts: CourseRequest[];
}

export interface ExamSession {
  id: string;
  subject: Subject;
  tutor: { id: string; firstName: string; lastInitial: string; school?: string; avatarUrl?: string | null };
  startsAt: string;
  durationMin: number;
  placesMin: number;
  placesMax: number;
  placesTaken: number;
  pricePerPlaceMillimes: number;
  confirmed: boolean;
  booked: boolean;
  status?: 'ouverte' | 'annulee';
  description?: string;
  /** Prénoms des inscrits, visibles seulement par le tuteur de la session. */
  students?: { firstName: string; school: string }[];
}

// ----- Notifications et messages (Objectif 4)

export type NotificationType =
  | 'demande_recue'
  | 'demande_acceptee'
  | 'demande_refusee'
  | 'demande_expiree'
  | 'cours_annule'
  | 'cours_termine'
  | 'avis_recu'
  | 'versement'
  | 'signalement'
  | 'signalement_traite'
  | 'message'
  | 'session_reservee'
  | 'session_annulee'
  | 'tuteur_valide'
  | 'contact';
export interface AppNotification {
  id: string;
  type: NotificationType;
  params: Record<string, string | number>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationList {
  unread: number;
  items: AppNotification[];
}

export interface ChatMessage {
  id: string;
  body: string;
  masked: boolean;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
}
export interface ChatPartner {
  id: string;
  name: string;
  school: string;
  avatarUrl: string | null;
  role?: Role;
}
export interface Thread {
  partner: ChatPartner;
  last: ChatMessage;
  unread: number;
}
export interface ThreadDetail {
  partner: ChatPartner;
  canWrite: boolean;
  messages: ChatMessage[];
}

// ----- Accueil

export interface PlatformStats {
  tutors: number;
  subjects: number;
  students: number;
  courses: number;
  hoursTaught: number;
  averageRating: number | null;
}
export interface LatestReview {
  author: string;
  school: string;
  authorAvatarUrl: string | null;
  tutor: { id: string; name: string };
  subject: Subject;
  rating: number;
  comment: string;
  date: string;
}

// ----- Administration

export interface AdminOverview {
  tutors: { validated: number; pending: number };
  reports: number;
  contacts: number;
  requests: { state: RequestState; count: number; volumeMillimes: number }[];
}
export interface PendingTutor {
  id: string;
  name: string;
  email: string;
  school: string;
  year: string;
  declaredAverage: number | null;
  subjects: string[];
  createdAt: string;
}
export interface AdminSubject extends Subject {
  tutors: number;
}
export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  topic: 'question' | 'tuteur' | 'probleme' | 'partenariat';
  message: string;
  status: 'nouveau' | 'traite';
  createdAt: string;
}
export interface Paged<T> {
  total: number;
  page: number;
  pages: number;
  items: T[];
}

/** Types partagés avec l'API (montants en millimes : 1 DT = 1000). */
export type Role = 'etudiant' | 'tuteur' | 'admin';
export type Lang = 'fr' | 'ar' | 'en';
export type RequestState =
  | 'en_attente' | 'acceptee' | 'faite' | 'versee' | 'signalee'
  | 'refusee' | 'expiree' | 'annulee' | 'annulee_tuteur';

export interface Subject { id: number; code: string; nameFr: string; nameAr: string; nameEn: string; }

export interface User {
  id: string; email: string; role: Role; firstName: string; lastName: string;
  school: string; year: string; lang: Lang;
  tutorStatus: 'en_attente' | 'valide' | null; tutorProfileId: string | null;
  balanceMillimes?: number;
}
export interface Session { token: string; user: User; }

export interface SubjectPrice { code: string; nameFr: string; nameAr: string; nameEn: string; pricePerHourMillimes: number; }
export interface TutorCard {
  id: string; firstName: string; lastInitial: string; school: string; year: string; bio: string;
  languages: Lang[]; rating: number | null; ratingCount: number; isNew: boolean; hoursTaught: number;
  responseRate: number | null; subjects: SubjectPrice[]; pricePerHourMillimes: number | null;
  nextSlot: string | null; freeSlotCount: number;
}
export interface Slot { id: number; startsAt: string; durationMin: number; booked: boolean; }
export interface ReviewView { author: string; subject: Subject; rating: number; comment: string; date: string; }
export interface TutorDetail extends TutorCard { declaredAverageVerified: boolean; slots: Slot[]; reviews: ReviewView[]; }

export interface CourseRequest {
  id: string; state: RequestState; subject: Subject; startsAt: string; durationMin: number;
  amountMillimes: number; feeMillimes: number; totalMillimes: number; payWith: 'credits' | 'carte';
  attachmentName: string | null; message: string; expiresAt: string; answeredAt: string | null;
  doneAt: string | null; payoutAt: string | null; reportReason: string | null; createdAt: string;
  student: { id: string; firstName: string; school: string };
  tutor: { id: string; firstName: string; lastInitial: string };
  review: { rating: number; comment: string } | null; canReview: boolean; canReport: boolean;
}
export interface CourseDocument { id: number; kind: 'pdf' | 'replay'; name: string; url: string; }
export interface Classroom extends CourseRequest { role: Role; jitsiRoom: string; jitsiUrl: string; documents: CourseDocument[]; }

export interface CreditMovement { id: number; amountMillimes: number; reason: 'recharge' | 'paiement' | 'remboursement'; label: string; requestId: string | null; createdAt: string; }
export interface CreditHistory { balanceMillimes: number; movements: CreditMovement[]; }

export interface TutorDashboard {
  earnedThisMonthMillimes: number; pendingPayoutMillimes: number; responseRate: number | null;
  rating: number | null; ratingCount: number; hoursTaught: number; status: 'en_attente' | 'valide';
  nextCourse: CourseRequest | null; pendingRequests: number;
}

export interface ExamSession {
  id: string; subject: Subject; tutor: { id: string; firstName: string; lastInitial: string };
  startsAt: string; durationMin: number; placesMin: number; placesMax: number; placesTaken: number;
  pricePerPlaceMillimes: number; confirmed: boolean; booked: boolean;
}

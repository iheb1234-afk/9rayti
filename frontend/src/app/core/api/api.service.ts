import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AdminOverview,
  AdminSubject,
  ChatMessage,
  Classroom,
  ContactMessage,
  CourseDocument,
  CourseRequest,
  CreditHistory,
  ExamSession,
  Lang,
  LatestReview,
  NotificationList,
  Paged,
  PendingTutor,
  PlatformStats,
  Revenue,
  Role,
  Session,
  Slot,
  Subject,
  SubjectPrice,
  Thread,
  ThreadDetail,
  TutorCard,
  TutorDashboard,
  TutorDetail,
  TutorOwnProfile,
  User,
} from './models';

export interface SearchFilters {
  subject?: string;
  maxPrice?: number;
  minRating?: number;
  lang?: Lang;
  when?: 'semaine' | 'soir' | 'weekend';
  sort?: 'pertinence' | 'prix' | 'note';
}
export interface RegisterPayload {
  role: Exclude<Role, 'admin'>;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  school: string;
  year: string;
  lang?: Lang;
  declaredAverage?: number;
  bio?: string;
  subjects?: { code: string; pricePerHourDt: number }[];
}
export interface NewRequest {
  tutorId: string;
  subjectCode: string;
  slotId: number;
  payWith: 'credits' | 'carte';
  attachmentName?: string;
  message?: string;
}
export interface NewExamSession {
  subjectCode: string;
  startsAt: string;
  durationMin: number;
  placesMin: number;
  placesMax: number;
  pricePerPlaceDt: number;
  description?: string;
}
export interface ContactForm {
  name: string;
  email: string;
  topic: ContactMessage['topic'];
  message: string;
}

/** Point d'accès unique à l'API REST : chaque méthode = une route documentée dans Swagger (/api/docs). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly base = environment.apiUrl;

  private params(filters: object): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return p;
  }

  /** Les photos sont servies par l'API : « /users/…/avatar » devient une URL complète. */
  asset(path: string | null | undefined): string | null {
    if (!path) return null;
    return path.startsWith('data:') || path.startsWith('http') ? path : `${this.base}${path}`;
  }

  // ----- Comptes
  register(body: RegisterPayload) {
    return this.http.post<Session>(`${this.base}/auth/register`, body);
  }
  login(email: string, password: string) {
    return this.http.post<Session>(`${this.base}/auth/login`, { email, password });
  }
  me() {
    return this.http.get<User>(`${this.base}/auth/me`);
  }
  setLang(lang: Lang) {
    return this.http.patch<User>(`${this.base}/auth/me/lang`, { lang });
  }
  updateMe(patch: Partial<Pick<User, 'firstName' | 'lastName' | 'school' | 'year'>>) {
    return this.http.patch<User>(`${this.base}/auth/me`, patch);
  }
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<{ ok: true }>(`${this.base}/auth/me/password`, { currentPassword, newPassword });
  }
  setAvatar(dataUrl: string) {
    return this.http.put<User>(`${this.base}/auth/me/avatar`, { dataUrl });
  }
  removeAvatar() {
    return this.http.delete<User>(`${this.base}/auth/me/avatar`);
  }

  // ----- Catalogue et contenus publics
  subjects() {
    return this.http.get<Subject[]>(`${this.base}/subjects`);
  }
  searchTutors(f: SearchFilters) {
    return this.http.get<TutorCard[]>(`${this.base}/tutors`, { params: this.params(f) });
  }
  tutor(id: string) {
    return this.http.get<TutorDetail>(`${this.base}/tutors/${id}`);
  }
  stats() {
    return this.http.get<PlatformStats>(`${this.base}/stats`);
  }
  latestReviews() {
    return this.http.get<LatestReview[]>(`${this.base}/reviews/latest`);
  }
  contact(form: ContactForm) {
    return this.http.post<{ ok: true }>(`${this.base}/contact`, form);
  }

  // ----- Demandes de cours (étudiant)
  createRequest(body: NewRequest) {
    return this.http.post<CourseRequest>(`${this.base}/requests`, body);
  }
  myRequests() {
    return this.http.get<CourseRequest[]>(`${this.base}/requests/mine`);
  }
  cancel(id: string) {
    return this.http.post<CourseRequest>(`${this.base}/requests/${id}/cancel`, {});
  }
  report(id: string, reason: string) {
    return this.http.post<CourseRequest>(`${this.base}/requests/${id}/report`, { reason });
  }
  review(id: string, rating: number, comment: string) {
    return this.http.post<CourseRequest>(`${this.base}/requests/${id}/review`, { rating, comment });
  }

  // ----- Favoris (étudiant)
  favorites() {
    return this.http.get<TutorCard[]>(`${this.base}/favorites`);
  }
  favoriteIds() {
    return this.http.get<string[]>(`${this.base}/favorites/ids`);
  }
  addFavorite(tutorId: string) {
    return this.http.put<string[]>(`${this.base}/favorites/${tutorId}`, {});
  }
  removeFavorite(tutorId: string) {
    return this.http.delete<string[]>(`${this.base}/favorites/${tutorId}`);
  }

  // ----- Espace tuteur
  tutorRequests() {
    return this.http.get<CourseRequest[]>(`${this.base}/tutor/requests`);
  }
  tutorDashboard() {
    return this.http.get<TutorDashboard>(`${this.base}/tutor/dashboard`);
  }
  tutorRevenue() {
    return this.http.get<Revenue>(`${this.base}/tutor/revenue`);
  }
  tutorProfile() {
    return this.http.get<TutorOwnProfile>(`${this.base}/tutor/profile`);
  }
  updateTutorProfile(patch: { bio?: string; languages?: Lang[] }) {
    return this.http.patch<TutorOwnProfile>(`${this.base}/tutor/profile`, patch);
  }
  act(id: string, action: 'accept' | 'refuse' | 'tutor-cancel' | 'complete', body: { recap?: string } = {}) {
    return this.http.post<CourseRequest>(`${this.base}/requests/${id}/${action}`, body);
  }
  mySlots() {
    return this.http.get<Slot[]>(`${this.base}/tutor/slots`);
  }
  addSlot(startsAt: string, durationMin: number) {
    return this.http.post<Slot>(`${this.base}/tutor/slots`, { startsAt, durationMin });
  }
  removeSlot(id: number) {
    return this.http.delete<void>(`${this.base}/tutor/slots/${id}`);
  }
  myRates() {
    return this.http.get<SubjectPrice[]>(`${this.base}/tutor/rates`);
  }
  setRate(subjectCode: string, pricePerHourDt: number) {
    return this.http.put(`${this.base}/tutor/rates`, { subjectCode, pricePerHourDt });
  }
  myExamSessionsAsTutor() {
    return this.http.get<ExamSession[]>(`${this.base}/tutor/exam-sessions`);
  }
  createExamSession(body: NewExamSession) {
    return this.http.post<ExamSession>(`${this.base}/tutor/exam-sessions`, body);
  }

  // ----- Salle de cours
  classroom(id: string) {
    return this.http.get<Classroom>(`${this.base}/classroom/${id}`);
  }
  addDocument(id: string, kind: 'pdf' | 'replay', name: string, url: string) {
    return this.http.post<CourseDocument>(`${this.base}/classroom/${id}/documents`, { kind, name, url });
  }

  // ----- Crédits
  credits() {
    return this.http.get<CreditHistory>(`${this.base}/credits/me`);
  }
  recharge(amountDt: number) {
    return this.http.post<CreditHistory>(`${this.base}/credits/recharge`, { amountDt });
  }

  // ----- Sessions d'examen
  examSessions(subject?: string) {
    return this.http.get<ExamSession[]>(`${this.base}/exam-sessions`, { params: this.params({ subject }) });
  }
  myExamSessions() {
    return this.http.get<ExamSession[]>(`${this.base}/exam-sessions/mine`);
  }
  examSession(id: string, asViewer = false) {
    return this.http.get<ExamSession>(`${this.base}/exam-sessions/${id}${asViewer ? '/me' : ''}`);
  }
  bookExam(id: string) {
    return this.http.post<ExamSession>(`${this.base}/exam-sessions/${id}/book`, {});
  }

  // ----- Messages
  threads() {
    return this.http.get<Thread[]>(`${this.base}/messages`);
  }
  thread(partnerId: string) {
    return this.http.get<ThreadDetail>(`${this.base}/messages/${partnerId}`);
  }
  sendMessage(partnerId: string, body: string) {
    return this.http.post<ChatMessage>(`${this.base}/messages/${partnerId}`, { body });
  }

  // ----- Notifications
  notifications() {
    return this.http.get<NotificationList>(`${this.base}/notifications`);
  }
  readNotifications(id?: string) {
    return this.http.post<NotificationList>(`${this.base}/notifications/${id ? `${id}/` : ''}read`, {});
  }

  // ----- Administration
  adminOverview() {
    return this.http.get<AdminOverview>(`${this.base}/admin/overview`);
  }
  pendingTutors() {
    return this.http.get<PendingTutor[]>(`${this.base}/admin/tutors/pending`);
  }
  validateTutor(id: string) {
    return this.http.post(`${this.base}/admin/tutors/${id}/validate`, {});
  }
  adminReports() {
    return this.http.get<CourseRequest[]>(`${this.base}/admin/reports`);
  }
  resolveReport(id: string, decision: 'rembourser' | 'verser', note: string) {
    return this.http.post<CourseRequest>(`${this.base}/admin/reports/${id}/resolve`, { decision, note });
  }
  adminRequests(q: { state?: string; search?: string; page?: number }) {
    return this.http.get<Paged<CourseRequest>>(`${this.base}/admin/requests`, { params: this.params(q) });
  }
  adminSubjects() {
    return this.http.get<AdminSubject[]>(`${this.base}/admin/subjects`);
  }
  addSubject(s: Omit<Subject, 'id'>) {
    return this.http.post<Subject>(`${this.base}/admin/subjects`, s);
  }
  updateSubject(id: number, patch: Partial<Omit<Subject, 'id' | 'code'>>) {
    return this.http.patch<Subject>(`${this.base}/admin/subjects/${id}`, patch);
  }
  contactMessages() {
    return this.http.get<ContactMessage[]>(`${this.base}/admin/contact`);
  }
  setContactStatus(id: number, status: ContactMessage['status']) {
    return this.http.patch<ContactMessage[]>(`${this.base}/admin/contact/${id}`, { status });
  }
}

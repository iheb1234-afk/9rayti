import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Classroom,
  CourseDocument,
  CourseRequest,
  CreditHistory,
  ExamSession,
  Lang,
  Role,
  Session,
  Slot,
  Subject,
  SubjectPrice,
  TutorCard,
  TutorDashboard,
  TutorDetail,
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

/** Point d'accès unique à l'API REST : chaque méthode = une route documentée dans Swagger. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private params(filters: object): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(filters))
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return p;
  }

  // Comptes
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

  // Catalogue
  subjects() {
    return this.http.get<Subject[]>(`${this.base}/subjects`);
  }
  searchTutors(f: SearchFilters) {
    return this.http.get<TutorCard[]>(`${this.base}/tutors`, { params: this.params(f) });
  }
  tutor(id: string) {
    return this.http.get<TutorDetail>(`${this.base}/tutors/${id}`);
  }

  // Demandes de cours (étudiant)
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

  // Espace tuteur
  tutorRequests() {
    return this.http.get<CourseRequest[]>(`${this.base}/tutor/requests`);
  }
  tutorDashboard() {
    return this.http.get<TutorDashboard>(`${this.base}/tutor/dashboard`);
  }
  act(id: string, action: 'accept' | 'refuse' | 'tutor-cancel' | 'complete') {
    return this.http.post<CourseRequest>(`${this.base}/requests/${id}/${action}`, {});
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

  // Salle de cours
  classroom(id: string) {
    return this.http.get<Classroom>(`${this.base}/classroom/${id}`);
  }
  addDocument(id: string, kind: 'pdf' | 'replay', name: string, url: string) {
    return this.http.post<CourseDocument>(`${this.base}/classroom/${id}/documents`, {
      kind,
      name,
      url,
    });
  }

  // Crédits
  credits() {
    return this.http.get<CreditHistory>(`${this.base}/credits/me`);
  }
  recharge(amountDt: number) {
    return this.http.post<CreditHistory>(`${this.base}/credits/recharge`, { amountDt });
  }

  // Sessions d'examen
  examSessions(subject?: string): Observable<ExamSession[]> {
    return this.http.get<ExamSession[]>(`${this.base}/exam-sessions`, {
      params: this.params({ subject }),
    });
  }
  myExamSessions() {
    return this.http.get<ExamSession[]>(`${this.base}/exam-sessions/mine`);
  }
  bookExam(id: string) {
    return this.http.post<ExamSession>(`${this.base}/exam-sessions/${id}/book`, {});
  }
}

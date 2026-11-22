import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../api/api.service';
import { AppNotification, ChatMessage, Thread } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { LangService } from '../i18n/lang.service';
import { ToastService } from '../ui/toast.service';
import { notificationParams } from './notification-text';

/**
 * Notifications et messages en temps réel. Une connexion Server-Sent Events reste ouverte tant
 * que l'utilisateur est connecté ; elle se rétablit seule si le réseau coupe (attente croissante).
 * En mode démo (sans serveur), la liste est simplement relue de temps en temps.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly lang = inject(LangService);

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  readonly threads = signal<Thread[]>([]);
  readonly unreadMessages = computed(() => this.threads().reduce((s, t) => s + t.unread, 0));
  /** Nouveaux messages reçus, pour la conversation ouverte. */
  readonly incoming = new Subject<{ partnerId: string; message: ChatMessage }>();

  private source: EventSource | null = null;
  private retry = 2000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const token = this.auth.token();
      this.disconnect();
      if (!token || this.auth.role() === null) {
        this.items.set([]);
        this.unread.set(0);
        this.threads.set([]);
        return;
      }
      this.refresh();
      if (environment.demo)
        this.timer = setInterval(() => this.refresh(), 20_000) as unknown as ReturnType<
          typeof setTimeout
        >;
      else this.connect(token);
    });
  }

  refresh(): void {
    this.api.notifications().subscribe({
      next: (l) => {
        this.items.set(l.items);
        this.unread.set(l.unread);
      },
      error: () => undefined,
    });
    if (this.auth.role() !== 'admin') this.refreshThreads();
  }

  refreshThreads(): void {
    this.api.threads().subscribe({ next: (t) => this.threads.set(t), error: () => undefined });
  }

  /** Texte traduit d'une notification. */
  text(n: AppNotification, money: (m: number) => string): string {
    const params = notificationParams(n, this.lang.lang(), money);
    const key =
      n.type === 'signalement_traite'
        ? `notif.signalement_traite_${params['decision'] ?? 'rembourser'}`
        : `notif.${n.type}`;
    return this.i18n.translate(key, params);
  }

  markAllRead(): void {
    this.unread.set(0);
    this.items.update((l) =>
      l.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    this.api.readNotifications().subscribe({ error: () => undefined });
  }

  markRead(n: AppNotification): void {
    if (n.readAt) return;
    this.unread.update((u) => Math.max(0, u - 1));
    this.items.update((l) =>
      l.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    this.api.readNotifications(n.id).subscribe({ error: () => undefined });
  }

  /** Autorise les notifications du système (quand l'onglet est en arrière-plan). */
  async enableBrowserNotifications(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.requestPermission();
  }

  private connect(token: string): void {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(
      `${this.api.base}/notifications/stream?token=${encodeURIComponent(token)}`,
    );
    this.source = es;
    es.addEventListener('open', () => (this.retry = 2000));
    es.addEventListener('notification', (e) =>
      this.onNotification(JSON.parse((e as MessageEvent).data) as AppNotification),
    );
    es.addEventListener('message', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        partnerId: string;
        message: ChatMessage;
      };
      this.incoming.next(data);
      this.refreshThreads();
    });
    es.onerror = () => {
      es.close();
      if (this.source !== es) return;
      this.source = null;
      // Reconnexion avec une attente qui double (2 s, 4 s… jusqu'à 30 s).
      this.timer = setTimeout(
        () => this.auth.token() && this.connect(this.auth.token()!),
        this.retry,
      );
      this.retry = Math.min(this.retry * 2, 30_000);
    };
  }

  private onNotification(n: AppNotification): void {
    this.items.update((l) => [n, ...l].slice(0, 30));
    this.unread.update((u) => u + 1);
    const money = (m: number) => `${(m / 1000).toLocaleString(this.lang.locale())} DT`;
    const text = this.text(n, money);
    // La notification d'un message n'apparaît pas en bulle si la conversation est déjà ouverte.
    if (n.type !== 'message' || !location.pathname.includes(n.link ?? '§'))
      this.toast.show(text, 'info');
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      new Notification('9rayti', { body: text, icon: 'icons/icon-192.png', tag: n.id });
    }
  }

  private disconnect(): void {
    this.source?.close();
    this.source = null;
    if (this.timer) clearTimeout(this.timer);
    if (this.timer) clearInterval(this.timer as unknown as ReturnType<typeof setInterval>);
    this.timer = null;
  }
}

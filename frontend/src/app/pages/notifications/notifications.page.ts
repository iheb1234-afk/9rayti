import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { UI } from '../../components';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { AppNotification } from '../../core/api/models';
import { LangService } from '../../core/i18n/lang.service';
import { NOTIFICATION_ICON } from '../../core/notifications/notification-text';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { DtPipe } from '../../pipes/dt.pipe';

/** Toutes les notifications, avec un lien direct vers la page concernée (idée reprise de Talmidon). */
@Component({
  selector: 'app-notifications-page',
  imports: [TranslocoPipe, PageHeaderComponent, EmptyStateComponent, ...UI],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="wrap">
    <app-page-header [title]="'notif.title' | transloco" [subtitle]="'notif.sub' | transloco">
      @if (notifs.unread() > 0) {
        <button type="button" class="btn alt" (click)="notifs.markAllRead()"><app-icon name="check" /> {{ 'notif.readAll' | transloco }}</button>
      }
      @if (permission() === 'default') {
        <button type="button" class="btn ghost" (click)="enable()"><app-icon name="bell" /> {{ 'profile.notifEnable' | transloco }}</button>
      }
    </app-page-header>
    <ul class="list">
      @for (n of notifs.items(); track n.id; let i = $index) {
        <li [style.animation-delay.ms]="i * 35">
          <button type="button" class="card item" [class.unread]="!n.readAt" (click)="go(n)">
            <span class="ic-w t-{{ n.type }}"><app-icon [name]="icon(n)" /></span>
            <span class="txt">{{ text(n) }}<span class="small muted">{{ n.createdAt | when: 'relative' }} · {{ n.createdAt | when }}</span></span>
            @if (!n.readAt) {
              <span class="new" aria-hidden="true"></span><span class="sr-only">{{ 'notif.new' | transloco }}</span>
            }
          </button>
        </li>
      } @empty {
        <app-empty-state icon="bell" [title]="'notif.none' | transloco" [text]="'notif.noneD' | transloco" />
      }
    </ul>
  </div>`,
  styles: `
    .list { list-style: none; padding: 0; margin: 18px 0 0; display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
    li { animation: rise 0.45s var(--ease-out) both; }
    .item { width: 100%; display: flex; gap: 14px; align-items: center; padding: 14px 16px; text-align: start; color: var(--texte); font-size: 15px; }
    .item:hover { border-color: var(--lien); }
    .item.unread { border-inline-start: 4px solid var(--bleu); }
    .ic-w { width: 40px; height: 40px; border-radius: 12px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--bleu-clair); color: var(--lien); }
    .t-versement, .t-demande_acceptee, .t-tuteur_valide { background: var(--olivier-clair); color: var(--olivier-texte); }
    .t-signalement, .t-cours_annule, .t-demande_refusee { background: var(--brique-clair); color: var(--brique-texte); }
    .t-avis_recu, .t-cours_termine, .t-demande_expiree { background: var(--soleil-clair); color: var(--soleil-texte); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .new { width: 10px; height: 10px; border-radius: 50%; background: var(--bleu); animation: pop 0.4s var(--ease-spring); }
  `,
})
export class NotificationsPage {
  protected readonly notifs = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly dt = inject(DtPipe);
  protected readonly permission = signal(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  constructor() {
    inject(LangService).setTitle('notif.title');
    this.notifs.refresh();
  }

  protected text(n: AppNotification): string {
    return this.notifs.text(n, (m) => this.dt.transform(m));
  }

  protected icon(n: AppNotification): string {
    return NOTIFICATION_ICON[n.type] ?? 'bell';
  }

  protected go(n: AppNotification): void {
    this.notifs.markRead(n);
    if (n.link) void this.router.navigateByUrl(n.link);
  }

  protected async enable(): Promise<void> {
    this.permission.set(await this.notifs.enableBrowserNotifications());
  }
}

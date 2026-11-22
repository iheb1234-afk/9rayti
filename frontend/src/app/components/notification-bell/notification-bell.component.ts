import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNotification } from '../../core/api/models';
import { NOTIFICATION_ICON } from '../../core/notifications/notification-text';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { DtPipe } from '../../pipes/dt.pipe';
import { WhenPipe } from '../../pipes/when.pipe';
import { IconComponent } from '../icon/icon.component';

/** Cloche de l'en-tête : pastille du nombre de non-lues, menu des dernières notifications. */
@Component({
  selector: 'app-notification-bell',
  imports: [IconComponent, RouterLink, TranslocoPipe, WhenPipe],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="nb">
    <button
      type="button"
      class="bell"
      [class.ring]="notifs.unread() > 0"
      (click)="open.set(!open())"
      [attr.aria-expanded]="open()"
      aria-controls="notif-menu"
      [attr.aria-label]="'notif.title' | transloco"
    >
      <app-icon name="bell" />
      @if (notifs.unread() > 0) {
        <span class="dot" aria-hidden="true">{{
          notifs.unread() > 9 ? '9+' : notifs.unread()
        }}</span>
        <span class="sr-only">{{ 'notif.unread' | transloco: { n: notifs.unread() } }}</span>
      }
    </button>
    @if (open()) {
      <div
        class="menu card"
        id="notif-menu"
        role="region"
        [attr.aria-label]="'notif.title' | transloco"
      >
        <div class="between head">
          <b>{{ 'notif.title' | transloco }}</b>
          @if (notifs.unread() > 0) {
            <button type="button" class="linkbtn small" (click)="notifs.markAllRead()">
              {{ 'notif.readAll' | transloco }}
            </button>
          }
        </div>
        <ul>
          @for (n of notifs.items().slice(0, 7); track n.id) {
            <li>
              <button type="button" class="item" [class.unread]="!n.readAt" (click)="go(n)">
                <span class="ic-wrap"><app-icon [name]="icon(n)" /></span>
                <span class="txt"
                  >{{ text(n)
                  }}<span class="small muted when">{{ n.createdAt | when: 'relative' }}</span></span
                >
              </button>
            </li>
          } @empty {
            <li class="none small muted">{{ 'notif.none' | transloco }}</li>
          }
        </ul>
        <a routerLink="/notifications" class="all small" (click)="open.set(false)">{{
          'notif.seeAll' | transloco
        }}</a>
      </div>
    }
  </div>`,
  styles: `
    .nb {
      position: relative;
    }
    .bell {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid var(--trait);
      background: var(--blanc);
      color: var(--bleu-nuit);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .bell:hover {
      background: var(--fond);
    }
    .ring app-icon {
      display: inline-flex;
      animation: ring 2.4s ease-in-out infinite;
      transform-origin: 50% 2px;
    }
    .dot {
      position: absolute;
      top: -4px;
      inset-inline-end: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 9px;
      background: var(--brique);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--blanc);
      animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .menu {
      position: absolute;
      top: calc(100% + 10px);
      inset-inline-end: -8px;
      width: min(380px, 92vw);
      padding: 10px;
      z-index: 40;
      box-shadow: 0 24px 60px rgba(11, 60, 120, 0.22);
      transform-origin: top right;
      animation: drop 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .head {
      padding: 4px 6px 8px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 380px;
      overflow-y: auto;
    }
    .item {
      display: flex;
      gap: 10px;
      width: 100%;
      text-align: start;
      border: 0;
      background: none;
      padding: 9px 8px;
      border-radius: 10px;
      color: var(--texte);
      font-size: 14px;
    }
    .item:hover {
      background: var(--fond);
    }
    .item.unread {
      background: var(--bleu-clair);
    }
    .item.unread:hover {
      filter: brightness(0.98);
    }
    .ic-wrap {
      width: 30px;
      height: 30px;
      flex: none;
      border-radius: 50%;
      background: var(--blanc);
      color: var(--lien);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--trait);
    }
    .txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .when {
      font-size: 12px;
    }
    .none {
      padding: 18px;
      text-align: center;
    }
    .all {
      display: block;
      text-align: center;
      padding: 8px;
    }
    @keyframes ring {
      0%,
      70%,
      100% {
        transform: rotate(0);
      }
      75% {
        transform: rotate(14deg);
      }
      80% {
        transform: rotate(-12deg);
      }
      85% {
        transform: rotate(8deg);
      }
      90% {
        transform: rotate(-4deg);
      }
    }
    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-6px) scale(0.97);
      }
    }
  `,
})
export class NotificationBellComponent {
  protected readonly notifs = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly dt = inject(DtPipe);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly open = signal(false);

  protected text(n: AppNotification): string {
    return this.notifs.text(n, (m) => this.dt.transform(m));
  }

  protected icon(n: AppNotification): string {
    return NOTIFICATION_ICON[n.type] ?? 'bell';
  }

  protected go(n: AppNotification): void {
    this.notifs.markRead(n);
    this.open.set(false);
    if (n.link) void this.router.navigateByUrl(n.link);
  }

  /** Clic en dehors ou Échap : le menu se ferme. */
  @HostListener('document:click', ['$event'])
  protected outside(e: MouseEvent): void {
    if (this.open() && !(this.host.nativeElement as HTMLElement).contains(e.target as Node))
      this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.open.set(false);
  }
}

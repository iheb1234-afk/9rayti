import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UI } from '../../components';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ApiService } from '../../core/api/api.service';
import { ChatMessage, ThreadDetail } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/error-message';
import { LangService } from '../../core/i18n/lang.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { ToastService } from '../../core/ui/toast.service';

/**
 * Messages (sitemap de l'Objectif 2, espaces étudiant et tuteur). Les nouveaux messages arrivent
 * en direct ; les coordonnées sont masquées par le serveur, pour que les cours restent sur 9rayti.
 */
@Component({
  selector: 'app-messages-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, EmptyStateComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage {
  /** Interlocuteur ouvert (paramètre de route facultatif). */
  readonly partnerId = input<string>();
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly notifs = inject(NotificationsService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  private readonly i18n = inject(TranslocoService);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly messages = signal<ChatMessage[]>([]);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly thread = rxResource<ThreadDetail | undefined, string | undefined>({
    params: () => this.partnerId(),
    stream: ({ params }) => this.api.thread(params),
  });
  protected readonly threads = computed(() => this.notifs.threads());
  protected readonly maskedCount = computed(() => this.messages().filter((m) => m.masked).length);

  constructor() {
    this.lang.setTitle('nav.messages');
    this.notifs.refreshThreads();
    effect(() => {
      const t = this.thread.value();
      this.messages.set(t?.messages ?? []);
      if (t) {
        this.notifs.refreshThreads(); // la conversation ouverte est maintenant lue
        this.scrollDown();
      }
    });
    // Messages reçus en direct pour la conversation ouverte.
    this.notifs.incoming.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(({ partnerId, message }) => {
      if (partnerId !== this.partnerId()) return;
      this.messages.update((l) => [...l, message]);
      this.scrollDown();
    });
  }

  protected send(): void {
    const id = this.partnerId();
    const body = this.draft().trim();
    if (!id || !body || this.sending()) return;
    this.sending.set(true);
    this.api.sendMessage(id, body).subscribe({
      next: (m) => {
        this.sending.set(false);
        this.draft.set('');
        this.messages.update((l) => [...l, m]);
        this.notifs.refreshThreads();
        if (m.masked) this.toast.show(this.i18n.translate('msg.maskedToast'), 'info');
        this.scrollDown();
      },
      error: (e) => {
        this.sending.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }

  /** Entrée envoie, Maj+Entrée va à la ligne. */
  protected key(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }
}

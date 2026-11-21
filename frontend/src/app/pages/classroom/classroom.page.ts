import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/error-message';
import { LangService } from '../../core/i18n/lang.service';
import { StateBadgeComponent } from '../../components/state-badge/state-badge.component';
import { ToastService } from '../../core/ui/toast.service';
import { UI } from '../../components/index';

/**
 * Salle de cours : la plateforme EST la classe (visio, PDF, replay au même endroit),
 * c'est ce qui évite que l'étudiant et le tuteur continuent hors de 9rayti.
 */
@Component({
  selector: 'app-classroom',
  imports: [RouterLink, FormsModule, TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './classroom.page.html',
  styleUrl: './classroom.page.scss',
})
export class ClassroomPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly lang = inject(LangService);
  protected readonly room = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.classroom(params),
  });
  protected readonly joined = signal(false);
  protected readonly busy = signal(false);
  protected docName = '';
  protected docUrl = '';
  protected docKind: 'pdf' | 'replay' = 'pdf';

  /** URL Jitsi construite côté serveur (salle privée par cours), avec le nom affiché et la langue. */
  protected readonly src = computed<SafeResourceUrl>(() => {
    const r = this.room.value();
    const u = this.auth.user();
    if (!r?.jitsiUrl.startsWith('https://meet.jit.si/'))
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    const name = encodeURIComponent(`"${u?.firstName ?? ''} (9rayti)"`);
    const url = `${r.jitsiUrl}#userInfo.displayName=${name}&config.defaultLanguage="${this.lang.lang()}"&config.prejoinConfig.enabled=false`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    effect(() => {
      if (this.room.value()) this.lang.setTitle('room.title');
    });
  }

  msg(e: unknown) {
    return errorMessage(e);
  }

  complete(id: string): void {
    this.busy.set(true);
    this.api.act(id, 'complete').subscribe({
      next: () => {
        this.busy.set(false);
        this.joined.set(false);
        this.room.reload();
        this.toast.show(this.i18n.translate('tspace.done.complete'));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }

  addDoc(id: string): void {
    this.busy.set(true);
    this.api.addDocument(id, this.docKind, this.docName.trim(), this.docUrl.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.docName = '';
        this.docUrl = '';
        this.room.reload();
        this.toast.show(this.i18n.translate('room.docAdded'));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }
}

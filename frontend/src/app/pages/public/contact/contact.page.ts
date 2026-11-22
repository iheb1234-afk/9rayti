import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { UI } from '../../../components';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { ApiService, ContactForm } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { celebrate, originOf } from '../../../core/motion/motion';
import { RevealDirective } from '../../../directives/reveal.directive';

/** Contact : formulaire enregistré par l'API (POST /contact) et traité dans l'espace admin. */
@Component({
  selector: 'app-contact',
  imports: [RouterLink, FormsModule, TranslocoPipe, PageHeaderComponent, RevealDirective, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
})
export class ContactPage {
  /** ?sujet=tuteur présélectionne le sujet (lien depuis « Devenir tuteur »). */
  readonly sujet = input<string>();
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly topics: ContactForm['topic'][] = [
    'question',
    'tuteur',
    'probleme',
    'partenariat',
  ];
  protected form = { name: '', email: '', message: '' };
  protected readonly topic = linkedSignal<ContactForm['topic']>(() => {
    const s = this.sujet() as ContactForm['topic'] | undefined;
    return s && this.topics.includes(s) ? s : 'question';
  });
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(LangService).setTitle('contact.title');
    const u = this.auth.user();
    if (u) this.form = { ...this.form, name: `${u.firstName} ${u.lastName}`, email: u.email };
  }

  protected send(f: NgForm, event: Event): void {
    if (f.invalid) {
      f.control.markAllAsTouched();
      return;
    }
    const origin = originOf(event);
    this.busy.set(true);
    this.error.set(null);
    this.api
      .contact({
        name: this.form.name.trim(),
        email: this.form.email.trim(),
        topic: this.topic(),
        message: this.form.message.trim(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.sent.set(true);
          void celebrate(origin);
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(errorMessage(e));
        },
      });
  }

  protected again(): void {
    this.form = { ...this.form, message: '' };
    this.sent.set(false);
  }
}

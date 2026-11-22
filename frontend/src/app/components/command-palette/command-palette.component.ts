import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../core/api/api.service';
import { Subject, TutorCard } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { PaletteService } from '../../core/ui/palette.service';
import { IconComponent } from '../icon/icon.component';

interface Entry {
  kind: 'page' | 'subject' | 'tutor';
  icon: string;
  label: string;
  hint: string;
  url: string;
  query?: Record<string, string>;
}

/** Insensible aux accents et à la casse : « probabilites » trouve « Probabilités ». */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Recherche rapide (Ctrl+K / ⌘K) : pages, matières et tuteurs, au clavier.
 * Idée reprise de Talmidon ; les données sont chargées à la première ouverture.
 */
@Component({
  selector: 'app-command-palette',
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (palette.open()) {
    <div class="overlay" (click)="close()" aria-hidden="true"></div>
    <div class="pal card" role="dialog" aria-modal="true" [attr.aria-label]="'palette.title' | transloco">
      <div class="field">
        <app-icon name="search" />
        <input #q type="text" [value]="query()" (input)="query.set($any($event.target).value); active.set(0)" (keydown)="keys($event)"
          [placeholder]="'palette.placeholder' | transloco" role="combobox" aria-expanded="true" aria-controls="pal-list" [attr.aria-activedescendant]="'pal-' + active()" />
        <kbd>Esc</kbd>
      </div>
      <ul id="pal-list" role="listbox">
        @for (e of results(); track e.url + e.label; let i = $index) {
          <li [id]="'pal-' + i" role="option" [attr.aria-selected]="i === active()" [class.on]="i === active()" (click)="go(e)" (pointerenter)="active.set(i)">
            <span class="ic-w"><app-icon [name]="e.icon" /></span>
            <span class="lab">{{ e.label }}<small class="muted">{{ e.hint }}</small></span>
            <app-icon name="arrow-right" [flip]="true" />
          </li>
        } @empty {
          <li class="none muted small">{{ 'palette.none' | transloco }}</li>
        }
      </ul>
      <div class="foot small muted"><span><kbd>↑</kbd><kbd>↓</kbd> {{ 'palette.move' | transloco }}</span><span><kbd>↵</kbd> {{ 'palette.open' | transloco }}</span></div>
    </div>
  }`,
  styles: `
    .overlay { position: fixed; inset: 0; background: rgba(11, 30, 60, 0.45); backdrop-filter: blur(3px); z-index: 90; animation: fade 0.2s ease; }
    .pal { position: fixed; z-index: 91; top: 12vh; left: 50%; width: min(620px, calc(100% - 32px)); transform: translateX(-50%); padding: 0; overflow: hidden;
      box-shadow: 0 30px 80px rgba(11, 30, 60, 0.35); animation: pal-in 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
    .field { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--trait); color: var(--lien); }
    .field input { flex: 1; border: 0; background: transparent; font: inherit; font-size: 17px; color: var(--texte); outline: none; }
    ul { list-style: none; margin: 0; padding: 6px; max-height: 380px; overflow-y: auto; }
    li { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; cursor: pointer; color: var(--texte); }
    li.on { background: var(--bleu-clair); }
    .ic-w { width: 32px; height: 32px; border-radius: 9px; background: var(--fond); display: flex; align-items: center; justify-content: center; color: var(--lien); flex: none; }
    .lab { flex: 1; display: flex; flex-direction: column; }
    .lab small { font-size: 12.5px; }
    .none { padding: 22px; text-align: center; cursor: default; }
    .foot { display: flex; gap: 16px; padding: 8px 14px; border-top: 1px solid var(--trait); }
    kbd { font: inherit; font-size: 11.5px; border: 1px solid var(--trait); border-bottom-width: 2px; border-radius: 6px; padding: 1px 6px; background: var(--fond); color: var(--gris); margin-inline-end: 3px; }
    @keyframes pal-in { from { opacity: 0; transform: translate(-50%, -12px) scale(0.98); } }
  `,
})
export class CommandPaletteComponent {
  protected readonly palette = inject(PaletteService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LangService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslocoService);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly subjects = signal<Subject[]>([]);
  private readonly tutors = signal<TutorCard[]>([]);
  private loaded = false;
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('q');

  constructor() {
    effect(() => {
      if (!this.palette.open()) return;
      if (!this.loaded) {
        this.loaded = true;
        this.api.subjects().subscribe({ next: (s) => this.subjects.set(s), error: () => (this.loaded = false) });
        this.api.searchTutors({}).subscribe({ next: (t) => this.tutors.set(t), error: () => undefined });
      }
      setTimeout(() => this.input()?.nativeElement.focus());
    });
  }

  private pages(): Entry[] {
    const t = (k: string) => this.i18n.translate(k);
    const role = this.auth.role();
    const list: Entry[] = [
      { kind: 'page', icon: 'search', label: t('nav.find'), hint: t('palette.page'), url: '/recherche' },
      { kind: 'page', icon: 'users', label: t('nav.sessions'), hint: t('palette.page'), url: '/sessions' },
      { kind: 'page', icon: 'sparkles', label: t('nav.how'), hint: t('palette.page'), url: '/comment-ca-marche' },
      { kind: 'page', icon: 'graduation-cap', label: t('nav.teach'), hint: t('palette.page'), url: '/devenir-tuteur' },
      { kind: 'page', icon: 'mail', label: t('nav.contact'), hint: t('palette.page'), url: '/contact' },
    ];
    if (role) {
      list.unshift({ kind: 'page', icon: 'layout-dashboard', label: t('nav.mySpace'), hint: t('palette.page'), url: this.auth.homeFor(role) });
      list.push({ kind: 'page', icon: 'user', label: t('nav.profile'), hint: t('palette.page'), url: '/profil' });
      list.push({ kind: 'page', icon: 'bell', label: t('notif.title'), hint: t('palette.page'), url: '/notifications' });
    }
    if (role === 'etudiant' || role === 'tuteur') list.push({ kind: 'page', icon: 'message-square', label: t('nav.messages'), hint: t('palette.page'), url: '/messages' });
    return list;
  }

  protected readonly results = computed<Entry[]>(() => {
    this.lang.lang(); // retraduit les libellés si la langue change
    const q = fold(this.query().trim());
    const subjects: Entry[] = this.subjects().map((s) => ({
      kind: 'subject',
      icon: 'book-open',
      label: this.lang.subjectName(s),
      hint: this.i18n.translate('palette.subject'),
      url: '/recherche',
      query: { matiere: s.code },
    }));
    const tutors: Entry[] = this.tutors().map((t) => ({
      kind: 'tutor',
      icon: 'user',
      label: `${t.firstName} ${t.lastInitial}`,
      hint: `${t.school} · ${t.subjects.map((s) => this.lang.subjectName(s)).join(', ')}`,
      url: `/tuteurs/${t.id}`,
    }));
    const all = [...this.pages(), ...subjects, ...tutors];
    if (!q) return [...this.pages().slice(0, 5), ...subjects.slice(0, 4)];
    return all.filter((e) => fold(`${e.label} ${e.hint}`).includes(q)).slice(0, 10);
  });

  @HostListener('document:keydown', ['$event'])
  protected shortcut(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette.open.set(!this.palette.open());
      this.query.set('');
      this.active.set(0);
    } else if (e.key === 'Escape' && this.palette.open()) {
      this.close();
    }
  }

  protected keys(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown') this.active.set((this.active() + 1) % Math.max(n, 1));
    else if (e.key === 'ArrowUp') this.active.set((this.active() - 1 + n) % Math.max(n, 1));
    else if (e.key === 'Enter' && this.results()[this.active()]) this.go(this.results()[this.active()]);
    else return;
    e.preventDefault();
  }

  protected go(e: Entry): void {
    this.close();
    void this.router.navigate([e.url], { queryParams: e.query ?? {} });
  }

  protected close(): void {
    this.palette.open.set(false);
    this.query.set('');
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { StateBadgeComponent } from '../shared/state-badge.component';
import { ToastService, UI } from '../shared/ui';

/**
 * Salle de cours : la plateforme EST la classe (visio, PDF, replay au même endroit),
 * c'est ce qui évite que l'étudiant et le tuteur continuent hors de 9rayti.
 */
@Component({
  selector: 'app-classroom',
  imports: [RouterLink, FormsModule, TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <a class="back small" [routerLink]="auth.homeFor(auth.role())"><app-icon name="chevron-left" [flip]="true" /> {{ 'room.back' | transloco }}</a>
    @if (room.error(); as e) {
      <div class="empty"><div class="arcbig"><app-icon name="lock" /></div><h1>{{ 'room.closedT' | transloco }}</h1>
        <p class="muted" style="margin:8px 0 18px">{{ msg(e) }}</p><a class="btn" [routerLink]="auth.homeFor(auth.role())">{{ 'room.back' | transloco }}</a></div>
    } @else if (room.value(); as r) {
      <div class="between head">
        <div><h1>{{ r.subject | subject }}</h1>
          <div class="muted row">{{ r.startsAt | when }} · {{ r.durationMin }} min · <bdi>{{ r.tutor.firstName }} {{ r.tutor.lastInitial }}</bdi> & <bdi>{{ r.student.firstName }}</bdi> <app-state [state]="r.state" /></div></div>
        <a class="btn sm ghost" [href]="r.jitsiUrl" target="_blank" rel="noopener"><app-icon name="external-link" /> {{ 'room.newTab' | transloco }}</a>
      </div>

      <div class="room">
        <div>
          <div class="vid studs">
            @if (joined()) {
              <iframe [src]="src()" [title]="'room.video' | transloco" allow="camera; microphone; fullscreen; display-capture; autoplay" allowfullscreen></iframe>
            } @else {
              <div class="pre">
                <app-arc [name]="(r.role === 'tuteur' ? r.student.firstName : r.tutor.firstName + ' ' + r.tutor.lastInitial)" [size]="120" />
                <p>{{ 'room.ready' | transloco }}</p>
                <button type="button" class="btn big join" (click)="joined.set(true)"><app-icon name="video" /> {{ 'room.join' | transloco }}</button>
                <span class="small">{{ 'room.jitsi' | transloco }}</span>
              </div>
            }
          </div>
          @if (r.role === 'tuteur' && r.state === 'acceptee') {
            <div class="row endbar"><span class="small muted">{{ 'room.endHint' | transloco }}</span>
              <button type="button" class="btn danger" [disabled]="busy()" (click)="complete(r.id)"><app-icon name="phone-off" /> {{ 'room.end' | transloco }}</button></div>
          }
        </div>

        <aside class="card side">
          <h2 class="h3"><app-icon name="file-text" /> {{ 'room.docs' | transloco }}</h2>
          @for (d of r.documents; track d.id) {
            <a class="fl" [href]="d.url" target="_blank" rel="noopener"><span><app-icon [name]="d.kind === 'replay' ? 'play' : 'file-text'" /> {{ d.name }}</span><app-icon name="download" /></a>
          } @empty { <p class="small muted">{{ 'room.noDocs' | transloco }}</p> }

          @if (r.role === 'tuteur') {
            <form class="adddoc" (ngSubmit)="addDoc(r.id)">
              <div class="fld"><label for="d-name">{{ 'room.docName' | transloco }}</label><input id="d-name" [(ngModel)]="docName" name="docName" required minlength="2" /></div>
              <div class="fld"><label for="d-url">{{ 'room.docUrl' | transloco }}</label><input id="d-url" type="url" dir="ltr" [(ngModel)]="docUrl" name="docUrl" required placeholder="https://" /></div>
              <div class="row">
                <label class="small"><input type="radio" name="kind" value="pdf" [(ngModel)]="docKind" /> PDF</label>
                <label class="small"><input type="radio" name="kind" value="replay" [(ngModel)]="docKind" /> Replay</label>
                <button class="btn sm" type="submit" [disabled]="busy() || docName.length < 2 || !docUrl"><app-icon name="upload" /> {{ 'common.add' | transloco }}</button>
              </div>
            </form>
          }
          <div class="rules small muted">
            <p><app-icon name="message-square" /> {{ 'room.chatRule' | transloco }}</p>
            <p><app-icon name="shield-check" /> {{ 'room.stayRule' | transloco }}</p>
            @if (r.attachmentName) { <p><app-icon name="paperclip" /> {{ 'room.attached' | transloco }} <b>{{ r.attachmentName }}</b></p> }
            @if (r.message) { <p><app-icon name="info" /> « {{ r.message }} »</p> }
          </div>
        </aside>
      </div>
    } @else {
      <div class="skeleton" style="height:470px;margin-top:22px"></div>
    }
  </div>`,
  styles: `
    .back { display: inline-flex; gap: 4px; align-items: center; margin-top: 22px; }
    .head { margin-top: 12px; }
    .head h1 { font-size: 30px; }
    .room { display: grid; grid-template-columns: 1fr 340px; gap: 20px; margin-top: 18px; align-items: start; }
    .vid { background-color: var(--bleu-nuit); border-radius: 18px; height: 520px; position: relative; overflow: hidden; }
    .vid iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .pre { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #dce6f3; text-align: center; padding: 20px; }
    .join { background: #fff; color: var(--bleu); border-color: #fff; }
    .join:hover { background: var(--bleu-clair) !important; color: var(--bleu-nuit); }
    .endbar { justify-content: flex-end; margin-top: 12px; }
    .side { padding: 18px; }
    .h3 { font-size: 17px; margin-bottom: 8px; display: flex; gap: 8px; align-items: center; }
    .fl { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 9px 0; border-bottom: 1px solid var(--trait); font-size: 14.5px; color: var(--texte); }
    .adddoc { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--trait); }
    .adddoc .fld { margin-bottom: 8px; }
    .rules { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
    .rules p { display: flex; gap: 8px; }
    @media (max-width: 860px) {
      .room { grid-template-columns: 1fr; }
      .vid { height: 320px; }
      .head h1 { font-size: 24px; }
    }
  `,
})
export class ClassroomPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly lang = inject(LangService);
  protected readonly room = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.classroom(params) });
  protected readonly joined = signal(false);
  protected readonly busy = signal(false);
  protected docName = '';
  protected docUrl = '';
  protected docKind: 'pdf' | 'replay' = 'pdf';

  /** URL Jitsi construite côté serveur (salle privée par cours), avec le nom affiché et la langue. */
  protected readonly src = computed<SafeResourceUrl>(() => {
    const r = this.room.value();
    const u = this.auth.user();
    if (!r?.jitsiUrl.startsWith('https://meet.jit.si/')) return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    const name = encodeURIComponent(`"${u?.firstName ?? ''} (9rayti)"`);
    const url = `${r.jitsiUrl}#userInfo.displayName=${name}&config.defaultLanguage="${this.lang.lang()}"&config.prejoinConfig.enabled=false`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    effect(() => { if (this.room.value()) this.lang.setTitle('room.title'); });
  }

  msg(e: unknown) { return errorMessage(e); }

  complete(id: string): void {
    this.busy.set(true);
    this.api.act(id, 'complete').subscribe({
      next: () => { this.busy.set(false); this.joined.set(false); this.room.reload(); this.toast.show(this.i18n.translate('tspace.done.complete')); },
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }

  addDoc(id: string): void {
    this.busy.set(true);
    this.api.addDocument(id, this.docKind, this.docName.trim(), this.docUrl.trim()).subscribe({
      next: () => { this.busy.set(false); this.docName = ''; this.docUrl = ''; this.room.reload(); this.toast.show(this.i18n.translate('room.docAdded')); },
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }
}

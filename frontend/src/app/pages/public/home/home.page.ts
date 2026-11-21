import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { LangService } from '../../../core/i18n/lang.service';
import { UI } from '../../../components/index';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected subject = '';
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly sessions = toSignal(this.api.examSessions().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  constructor() {
    inject(LangService).setTitle('home.title');
  }

  go(): void {
    void this.router.navigate(['/recherche'], {
      queryParams: this.subject ? { matiere: this.subject } : {},
    });
  }
}

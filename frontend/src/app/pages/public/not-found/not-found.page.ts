import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangService } from '../../../core/i18n/lang.service';
import { UI } from '../../../components/index';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.page.html',
  styleUrl: './not-found.page.scss',
})
export class NotFoundPage {
  constructor() {
    inject(LangService).setTitle('e404.title');
  }
}

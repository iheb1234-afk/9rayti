import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from '../core/i18n/lang.service';

/** Nom d'une matière dans la langue active. */
@Pipe({ name: 'subject', pure: false })
export class SubjectPipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(s: { nameFr: string; nameAr: string; nameEn: string } | null | undefined): string {
    return this.lang.subjectName(s);
  }
}

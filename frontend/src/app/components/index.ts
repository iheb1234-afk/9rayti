/**
 * Point d'entrée des briques d'interface réutilisables : une page importe `UI`
 * pour disposer des composants, directives et pipes de base de la charte.
 */
import { AvatarComponent } from './avatar/avatar.component';
import { IconComponent } from './icon/icon.component';
import { LogoComponent } from './logo/logo.component';
import { StateBadgeComponent } from './state-badge/state-badge.component';
import { DtPipe } from '../pipes/dt.pipe';
import { NumPipe } from '../pipes/num.pipe';
import { SubjectPipe } from '../pipes/subject.pipe';
import { WhenPipe } from '../pipes/when.pipe';

export {
  AvatarComponent,
  IconComponent,
  LogoComponent,
  StateBadgeComponent,
  DtPipe,
  NumPipe,
  SubjectPipe,
  WhenPipe,
};

export const UI = [
  IconComponent,
  LogoComponent,
  AvatarComponent,
  StateBadgeComponent,
  DtPipe,
  WhenPipe,
  SubjectPipe,
  NumPipe,
] as const;

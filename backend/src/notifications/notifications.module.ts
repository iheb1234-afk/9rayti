import {
  Controller,
  Get,
  Global,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser } from '../common/roles';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('read')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  /**
   * Flux temps réel (Server-Sent Events). EventSource ne sait pas envoyer d'en-tête
   * Authorization : le jeton passe donc en paramètre, et il est vérifié ici.
   */
  @Sse('stream')
  stream(@Query('token') token: string): Observable<{ type: string; data: unknown }> {
    let user: AuthUser;
    try {
      user = this.jwt.verify<AuthUser>(token ?? '');
    } catch {
      throw new UnauthorizedException('Session expirée, reconnecte-toi');
    }
    return this.notifications.stream(user.sub);
  }
}

/** Global : n'importe quel module peut notifier sans l'importer explicitement. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

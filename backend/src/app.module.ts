import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CatalogModule } from './catalog/catalog.module';
import { Subject } from './catalog/subject.entity';
import { ContactModule } from './contact/contact.module';
import { CreditsModule } from './credits/credits.module';
import { ExamSessionsModule } from './exam-sessions/exam-sessions.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RequestsModule } from './requests/requests.module';
import { SeedService } from './seed/seed.service';
import { ProfilePhoto } from './users/profile-photo.entity';
import { User } from './users/user.entity';
import { UsersController } from './users/users.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://rayti:rayti@localhost:5433/rayti',
      autoLoadEntities: true,
      // Prototype : le schéma suit les entités. En production : migrations TypeORM.
      synchronize: process.env.DB_SYNC !== 'false',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([User, Subject, ProfilePhoto]),
    NotificationsModule,
    CreditsModule,
    CatalogModule,
    RequestsModule,
    ExamSessionsModule,
    AdminModule,
    FavoritesModule,
    MessagesModule,
    ContactModule,
  ],
  controllers: [AppController, AuthController, UsersController],
  providers: [AuthService, SeedService],
})
export class AppModule {}

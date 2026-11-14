import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { CreditsModule } from '../credits/credits.module';
import { CourseDocument } from './course-document.entity';
import { CourseRequest } from './course-request.entity';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { Review } from './review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CourseRequest, CourseDocument, Review, TutorProfile]), CreditsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseRequest } from '../requests/course-request.entity';
import { CatalogController, TutorSpaceController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Rate } from './rate.entity';
import { Slot } from './slot.entity';
import { Subject } from './subject.entity';
import { TutorProfile } from './tutor-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subject, TutorProfile, Rate, Slot, CourseRequest])],
  controllers: [CatalogController, TutorSpaceController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

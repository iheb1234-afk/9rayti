import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsString, Length } from 'class-validator';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import type { AuthUser } from '../common/roles';
import { AuthGuard, CurrentUser, Roles } from '../common/roles';
import { CourseRequest } from '../requests/course-request.entity';
import { User } from '../users/user.entity';
import { Message } from './message.entity';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsString()
  @Length(1, 1000)
  body!: string;
}

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Roles('etudiant', 'tuteur')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  threads(@CurrentUser() user: AuthUser) {
    return this.messages.threads(user);
  }

  @Get(':partnerId')
  thread(@CurrentUser() user: AuthUser, @Param('partnerId', ParseUUIDPipe) partnerId: string) {
    return this.messages.thread(user, partnerId);
  }

  @Post(':partnerId')
  send(
    @CurrentUser() user: AuthUser,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(user, partnerId, dto.body);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Message, TutorProfile, User, CourseRequest])],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

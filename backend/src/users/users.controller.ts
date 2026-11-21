import { Controller, Get, Header, NotFoundException, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { ProfilePhoto } from './profile-photo.entity';

@ApiTags('Comptes')
@Controller('users')
export class UsersController {
  constructor(@InjectRepository(ProfilePhoto) private readonly photos: Repository<ProfilePhoto>) {}

  /** Photo de profil. L'URL contient la version : le navigateur peut la garder en cache un an. */
  @Get(':id/avatar')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async avatar(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const photo = await this.photos.findOneBy({ userId: id });
    if (!photo) throw new NotFoundException('Pas de photo');
    res.type(photo.mime).send(photo.data);
  }
}

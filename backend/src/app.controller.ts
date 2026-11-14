import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Santé')
@Controller('health')
export class AppController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok', database: 'postgres', time: new Date().toISOString() };
  }
}

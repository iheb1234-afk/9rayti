import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(',') });
  // Refuse tout champ inconnu et convertit les types : les DTO sont la seule porte d'entrée.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const doc = new DocumentBuilder()
    .setTitle('API 9rayti')
    .setDescription('Tutorat entre étudiants : comptes, catalogue, demandes de cours, crédits, sessions d’examen.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API 9rayti : http://localhost:${port}/api  ·  documentation : http://localhost:${port}/api/docs`);
}
void bootstrap();

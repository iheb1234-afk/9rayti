import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Tests d'intégration : démarrent l'API complète sur la base PostgreSQL locale
 * (npm run db:local). Les comptes de démonstration sont créés au premier démarrage.
 */
describe('API 9rayti (e2e)', () => {
  let app: INestApplication<App>;
  let student: string;
  let tutor: string;

  const login = async (email: string) =>
    (await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'demo1234' }).expect(200)).body
      .token as string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    student = await login('omar@9rayti.tn');
    tutor = await login('sarra@9rayti.tn');
  });

  afterAll(() => app.close());

  it('GET /api/health répond avec la base de données', () =>
    request(app.getHttpServer()).get('/api/health').expect(200).expect((r) => expect(r.body.status).toBe('ok')));

  it('refuse un mauvais mot de passe', () =>
    request(app.getHttpServer()).post('/api/auth/login').send({ email: 'omar@9rayti.tn', password: 'mauvais1' }).expect(401));

  it('la recherche ne renvoie que des tuteurs validés de la matière', async () => {
    const r = await request(app.getHttpServer()).get('/api/tutors?subject=probabilites').expect(200);
    expect(r.body.length).toBeGreaterThan(0);
    for (const t of r.body) expect(t.subjects.map((s: { code: string }) => s.code)).toContain('probabilites');
  });

  it('protège les routes réservées', async () => {
    await request(app.getHttpServer()).get('/api/requests/mine').expect(401);
    await request(app.getHttpServer()).get('/api/tutor/dashboard').set('authorization', `Bearer ${student}`).expect(403);
  });

  it('parcours complet : demande → acceptation → salle de cours → fin', async () => {
    const tutors = await request(app.getHttpServer()).get('/api/tutors?subject=statistique').expect(200);
    const sarra = tutors.body.find((t: { firstName: string }) => t.firstName === 'Sarra');
    const detail = await request(app.getHttpServer()).get(`/api/tutors/${sarra.id}`).expect(200);
    const slot = detail.body.slots.filter((s: { booked: boolean }) => !s.booked).pop();

    const created = await request(app.getHttpServer())
      .post('/api/requests')
      .set('authorization', `Bearer ${student}`)
      .send({ tutorId: sarra.id, subjectCode: 'statistique', slotId: slot.id, payWith: 'carte' })
      .expect(201);
    expect(created.body.state).toBe('en_attente');
    expect(created.body.totalMillimes).toBe(created.body.amountMillimes + 3000);

    // Le même créneau ne peut pas être réservé deux fois.
    await request(app.getHttpServer())
      .post('/api/requests')
      .set('authorization', `Bearer ${student}`)
      .send({ tutorId: sarra.id, subjectCode: 'statistique', slotId: slot.id, payWith: 'carte' })
      .expect(409);

    // La salle reste fermée tant que le tuteur n'a pas accepté.
    await request(app.getHttpServer()).get(`/api/classroom/${created.body.id}`).set('authorization', `Bearer ${student}`).expect(403);

    const accepted = await request(app.getHttpServer())
      .post(`/api/requests/${created.body.id}/accept`)
      .set('authorization', `Bearer ${tutor}`)
      .expect(200);
    expect(accepted.body.state).toBe('acceptee');

    const room = await request(app.getHttpServer()).get(`/api/classroom/${created.body.id}`).set('authorization', `Bearer ${student}`).expect(200);
    expect(room.body.jitsiUrl).toMatch(/^https:\/\/meet\.jit\.si\/9rayti-/);

    // Une fois acceptée, l'étudiant ne peut plus annuler.
    await request(app.getHttpServer()).post(`/api/requests/${created.body.id}/cancel`).set('authorization', `Bearer ${student}`).expect(400);

    const done = await request(app.getHttpServer())
      .post(`/api/requests/${created.body.id}/complete`)
      .set('authorization', `Bearer ${tutor}`)
      .expect(200);
    expect(done.body.state).toBe('faite');
    expect(done.body.canReport).toBe(true);
  });
});

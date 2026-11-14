// Lance une base PostgreSQL locale, sans Docker ni installation (paquet npm embedded-postgres).
// Usage : npm run db:local   (laisser tourner dans un terminal)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const port = Number(process.env.DB_PORT ?? 5433);
const databaseDir = resolve(process.cwd(), '.pgdata');
const firstRun = !existsSync(databaseDir);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'rayti',
  password: 'rayti',
  port,
  persistent: true,
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase('rayti');
console.log(`PostgreSQL prêt sur localhost:${port} (base « rayti », utilisateur « rayti »). Ctrl+C pour arrêter.`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);

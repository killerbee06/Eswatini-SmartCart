import knex from 'knex';
import config from './index.js';

const connection = config.database.url;

if (!connection) {
  console.warn('⚠️  DATABASE_URL not set. Database will not be available.');
}

const db = knex({
  client: 'pg',
  connection,
  pool: { min: 2, max: 10 },
});

export default db;

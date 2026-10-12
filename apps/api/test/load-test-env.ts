import { config } from 'dotenv';
import { join } from 'node:path';

// override: true so a DATABASE_URL exported in the developer's shell can never
// point the tests, which truncate tables, at the development database.
config({
  path: join(__dirname, '..', '.env.test'),
  override: true,
  quiet: true,
});

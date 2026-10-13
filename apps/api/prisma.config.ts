// Prisma 7 does not load .env by itself.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // The seed runs only through `prisma db seed`, which reads this command.
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // process.env, not Prisma's env(): env() throws when the variable is unset,
    // which would break `prisma generate` on a fresh clone with no .env.
    url: process.env.DATABASE_URL,
  },
});

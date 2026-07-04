// Prisma 7 no longer auto-loads .env files; `dotenv/config` makes DATABASE_URL
// (declared as env("DATABASE_URL") in schema.prisma) available to the CLI.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});

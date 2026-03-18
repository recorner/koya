import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

const envFiles = [
  path.resolve(__dirname, '.env.local'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../.env.local'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/koya?schema=public',
  },
});

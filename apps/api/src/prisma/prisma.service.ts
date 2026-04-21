import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const rawUrl =
      configService.get<string>('DATABASE_URL') ??
      'postgresql://postgres:postgres@localhost:5432/koya?schema=public';
    const nodeEnv = configService.get<string>('NODE_ENV', process.env['NODE_ENV'] ?? 'development');
    const allowNonLocalTestDb =
      (configService.get<string>('ALLOW_NONLOCAL_TEST_DB') ??
        process.env['ALLOW_NONLOCAL_TEST_DB'] ??
        '') === 'true';

    // Strip sslmode/sslaccept from URL — pg v8 treats sslmode=require as verify-full.
    // We handle SSL via PoolConfig instead.
    const url = new URL(rawUrl);
    const dbHost = (url.hostname || '').toLowerCase();
    const isLocalHost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1';
    if (nodeEnv === 'test' && !isLocalHost && !allowNonLocalTestDb) {
      throw new Error(
        `Refusing to run tests against non-local DATABASE_URL host='${dbHost}'. Set ALLOW_NONLOCAL_TEST_DB=true only for intentional, isolated test databases.`,
      );
    }
    const needsSsl = url.searchParams.get('sslmode') === 'require';
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslaccept');
    const connectionString = url.toString();

    const adapter = new PrismaPg({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

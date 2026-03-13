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

    // Strip sslmode/sslaccept from URL — pg v8 treats sslmode=require as verify-full.
    // We handle SSL via PoolConfig instead.
    const url = new URL(rawUrl);
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

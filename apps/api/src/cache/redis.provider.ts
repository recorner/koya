import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

const logger = new Logger('RedisProvider');

export const RedisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService): Redis => {
    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);
    const password = config.get<string>('REDIS_PASSWORD', '');
    const db = config.get<number>('REDIS_DB', 0);
    const tls = config.get<string>('REDIS_TLS', 'false') === 'true';

    const client = new Redis({
      host,
      port,
      ...(password ? { password } : {}),
      db,
      ...(tls ? { tls: {} } : {}),
      enableReadyCheck: true,
      // Prevent process-crashing MaxRetriesPerRequestError during transient Redis outages.
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        logger.warn(`Redis reconnecting attempt ${times}, delay ${delay}ms`);
        return delay;
      },
      reconnectOnError(err: Error) {
        const targetErrors = ['READONLY', 'ECONNRESET'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    client.on('connect', () => {
      logger.log(`Connected to Redis at ${host}:${port} db=${db}`);
    });

    client.on('ready', () => {
      logger.log('Redis client ready');
    });

    client.on('error', (err: Error) => {
      logger.error(`Redis error: ${err.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return client;
  },
  inject: [ConfigService],
};

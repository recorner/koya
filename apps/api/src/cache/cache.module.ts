import {
  Global,
  Module,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { RedisProvider } from './redis.provider';
import { REDIS_CLIENT } from './cache.constants';

@Global()
@Module({
  providers: [RedisProvider, CacheService],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

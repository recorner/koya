import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, SkipThrottle } from '@nestjs/throttler';
import { Controller, Get, Post, Body } from '@nestjs/common';
import request from 'supertest';
import { RedisThrottlerStorage } from '../redis-throttler.storage';
import { KoyaThrottlerGuard } from '../koya-throttler.guard';
import { QuoteThrottle, WebhookThrottle } from '../throttle.decorators';

// Minimal in-memory Redis mock for integration testing
class MockRedis {
  private store = new Map<string, { value: string; expireAt?: number }>();

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expireAt) return -2;
    const remaining = Math.ceil((entry.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  multi() {
    const ops: Array<() => Promise<[null, number]>> = [];
    const self = this;
    const chain = {
      incr(key: string) {
        ops.push(async () => {
          const entry = self.store.get(key);
          const val = entry ? parseInt(entry.value, 10) + 1 : 1;
          self.store.set(key, {
            value: String(val),
            expireAt: entry?.expireAt,
          });
          return [null, val] as [null, number];
        });
        return chain;
      },
      pttl(key: string) {
        ops.push(async () => {
          const entry = self.store.get(key);
          if (!entry || !entry.expireAt) return [null, -1] as [null, number];
          const remaining = entry.expireAt - Date.now();
          return [null, remaining > 0 ? remaining : -1] as [null, number];
        });
        return chain;
      },
      async exec() {
        return Promise.all(ops.map((op) => op()));
      },
    };
    return chain;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expireAt = Date.now() + seconds * 1000;
    }
    return 1;
  }

  async set(
    key: string,
    value: string,
    _ex?: string,
    seconds?: number,
  ): Promise<string> {
    this.store.set(key, {
      value,
      expireAt: seconds ? Date.now() + seconds * 1000 : undefined,
    });
    return 'OK';
  }
}

// Test controllers
@Controller('test-quote')
class TestQuoteController {
  @Post()
  @QuoteThrottle()
  create() {
    return { ok: true };
  }
}

@Controller('test-webhook')
@WebhookThrottle()
class TestWebhookController {
  @Post('callback')
  handle(@Body() body: unknown) {
    return { received: true };
  }
}

@Controller('test-health')
@SkipThrottle()
class TestHealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

/**
 * Integration test: verifies that routes get 429 after limit exceeded,
 * webhook routes still work under threshold, and health routes skip throttling.
 */
describe('Throttling Integration', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let httpServer: any;

  beforeAll(async () => {
    const mockRedis = new MockRedis();
    const storage = new RedisThrottlerStorage(mockRedis as never);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', limit: 5, ttl: 60000 }, // Very low for testing
          ],
          storage,
        }),
      ],
      controllers: [
        TestQuoteController,
        TestWebhookController,
        TestHealthController,
      ],
      providers: [
        { provide: APP_GUARD, useClass: KoyaThrottlerGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 429 after quote endpoint limit exceeded', async () => {
    // QuoteThrottle decorator overrides the named 'default' throttler to limit=20
    const responses = [];
    for (let i = 0; i < 25; i++) {
      const res = await request(httpServer)
        .post('/test-quote')
        .send({})
        .set('X-Forwarded-For', '1.2.3.4');
      responses.push(res.status);
    }

    // First 20 should succeed, rest should be 429
    const successes = responses.filter((s) => s === 201);
    const throttled = responses.filter((s) => s === 429);
    expect(successes.length).toBe(20);
    expect(throttled.length).toBe(5);
  });

  it('should allow webhook requests under threshold', async () => {
    // WebhookThrottle: 120 req/min — well within for 10 requests
    for (let i = 0; i < 10; i++) {
      const res = await request(httpServer)
        .post('/test-webhook/callback')
        .send({ data: 'test' })
        .set('X-Forwarded-For', '5.6.7.8');
      expect(res.status).toBe(201);
    }
  });

  it('should skip throttling for health endpoint', async () => {
    // Health should never get 429 regardless of request count
    for (let i = 0; i < 50; i++) {
      const res = await request(httpServer)
        .get('/test-health')
        .set('X-Forwarded-For', '9.10.11.12');
      expect(res.status).toBe(200);
    }
  });
});

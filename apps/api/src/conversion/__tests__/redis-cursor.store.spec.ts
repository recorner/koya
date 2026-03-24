import { Test, TestingModule } from '@nestjs/testing';
import { RedisCursorStore } from '../redis-cursor.store';
import { REDIS_CLIENT } from '../../cache/cache.constants';

describe('RedisCursorStore', () => {
  let store: RedisCursorStore;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCursorStore,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    store = module.get(RedisCursorStore);
  });

  describe('getCursor', () => {
    it('should return null when no cursor stored', async () => {
      redis.get.mockResolvedValue(null);
      const result = await store.getCursor('test');
      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith('koya:cursor:test');
    });

    it('should return parsed integer when cursor exists', async () => {
      redis.get.mockResolvedValue('42');
      const result = await store.getCursor('test');
      expect(result).toBe(42);
    });

    it('should return null for non-numeric values', async () => {
      redis.get.mockResolvedValue('invalid');
      const result = await store.getCursor('test');
      expect(result).toBeNull();
    });
  });

  describe('setCursor', () => {
    it('should persist cursor value', async () => {
      redis.set.mockResolvedValue('OK');
      await store.setCursor('bria_event_consumer', 100);
      expect(redis.set).toHaveBeenCalledWith('koya:cursor:bria_event_consumer', '100');
    });
  });
});

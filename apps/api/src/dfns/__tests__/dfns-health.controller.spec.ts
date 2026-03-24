import { Test, TestingModule } from '@nestjs/testing';
import { DfnsHealthController } from '../dfns-health.controller';
import { DfnsService } from '../dfns.service';

describe('DfnsHealthController', () => {
  let controller: DfnsHealthController;
  let dfnsService: { healthcheck: jest.Mock };

  beforeEach(async () => {
    dfnsService = {
      healthcheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DfnsHealthController],
      providers: [{ provide: DfnsService, useValue: dfnsService }],
    }).compile();

    controller = module.get(DfnsHealthController);
  });

  it('should return ok when DFNS is healthy', async () => {
    dfnsService.healthcheck.mockResolvedValue({ ok: true, latencyMs: 45, mTls: true });

    const result = await controller.check();
    expect(result).toEqual({ status: 'ok', latencyMs: 45, mTls: true });
  });

  it('should return unhealthy when DFNS check fails', async () => {
    dfnsService.healthcheck.mockResolvedValue({ ok: false, latencyMs: 2000, mTls: false });

    const result = await controller.check();
    expect(result).toEqual({ status: 'unhealthy', latencyMs: 2000, mTls: false });
  });
});

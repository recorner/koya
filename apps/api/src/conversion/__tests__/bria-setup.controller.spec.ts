import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { BriaSetupController } from '../bria-setup.controller';
import { BriaSetupService } from '../bria-setup.service';

describe('BriaSetupController', () => {
  let controller: BriaSetupController;
  let setupService: jest.Mocked<BriaSetupService>;

  const createModule = async (config: Record<string, string | undefined>) => {
    setupService = {
      runFullSetup: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as jest.Mocked<BriaSetupService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BriaSetupController],
      providers: [
        { provide: BriaSetupService, useValue: setupService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    controller = module.get(BriaSetupController);
  };

  it('rejects production setup when BRIA_SETUP_ENABLED is not true', async () => {
    await createModule({
      ENVIRONMENT: 'production',
      BRIA_SETUP_ENABLED: 'false',
      ADMIN_API_KEY: 'admin-key',
    });

    await expect(
      controller.setup('admin-key', { xpub: 'xpub-test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows production setup when BRIA_SETUP_ENABLED=true and admin key matches', async () => {
    await createModule({
      ENVIRONMENT: 'production',
      BRIA_SETUP_ENABLED: 'true',
      ADMIN_API_KEY: 'admin-key',
    });

    await expect(
      controller.setup('admin-key', { xpub: 'xpub-test' }),
    ).resolves.toEqual({ success: true, results: { ok: true } });

    expect(setupService.runFullSetup).toHaveBeenCalledWith('xpub-test');
  });

  it('rejects invalid admin key', async () => {
    await createModule({
      ENVIRONMENT: 'staging',
      BRIA_SETUP_ENABLED: 'true',
      ADMIN_API_KEY: 'admin-key',
    });

    await expect(
      controller.setup('wrong-key', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

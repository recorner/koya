import { Controller, Get, Logger } from '@nestjs/common';
import { DfnsService } from './dfns.service';

@Controller('internal/health')
export class DfnsHealthController {
  private readonly logger = new Logger(DfnsHealthController.name);

  constructor(private readonly dfnsService: DfnsService) {}

  /**
   * GET /internal/health/dfns
   *
   * Validates DFNS connectivity via mTLS handshake (if configured)
   * or lightweight API probe. Designed for orchestration health checks.
   */
  @Get('dfns')
  async check() {
    const result = await this.dfnsService.healthcheck();

    if (!result.ok) {
      this.logger.warn(`DFNS health check FAILED (mTls=${result.mTls}, latency=${result.latencyMs}ms)`);
    }

    return {
      status: result.ok ? 'ok' : 'unhealthy',
      latencyMs: result.latencyMs,
      mTls: result.mTls,
    };
  }
}

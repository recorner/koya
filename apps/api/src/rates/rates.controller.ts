import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { RatesService } from './rates.service';

/**
 * Public rate endpoints.
 *
 * Routes:
 *   GET /api/v1/rates           — All supported pairs
 *   GET /api/v1/rates/health    — Module health report
 *   GET /api/v1/rates/:pair     — Single pair (use dash: BTC-USD)
 */
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  async getAllRates(@Query('fresh') fresh?: string) {
    const rates = await this.ratesService.getAllRates();
    const filtered =
      fresh === 'true' ? rates.filter((r) => !r.stale) : rates;

    return {
      success: true,
      data: filtered,
      count: filtered.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async health() {
    return this.ratesService.getHealthReport();
  }

  @Get(':pair')
  async getRate(
    @Param('pair') pairParam: string,
    @Query('includeSources') includeSources?: string,
  ) {
    // URL-safe format: BTC-USD → internal BTC/USD
    const pair = pairParam.replace('-', '/');
    const snapshot = await this.ratesService.getRate(pair);

    if (!snapshot) {
      throw new NotFoundException(`No rate available for ${pair}`);
    }

    const data =
      includeSources === 'true'
        ? snapshot
        : { ...snapshot, sources: undefined };

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}

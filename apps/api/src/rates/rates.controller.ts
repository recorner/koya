import { Controller, Get, Param, Query, Sse, NotFoundException, MessageEvent } from '@nestjs/common';
import { Observable, interval, switchMap, from, map, distinctUntilChanged } from 'rxjs';
import { RatesService } from './rates.service';

/**
 * Public rate endpoints.
 *
 * Routes:
 *   GET /api/v1/rates           — All supported pairs
 *   GET /api/v1/rates/health    — Module health report
 *   GET /api/v1/rates/stream    — SSE stream of live rates
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

  /**
   * SSE stream: pushes fresh rates every 2 s.
   * Only emits when data actually changes (distinctUntilChanged on mid values).
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(2000).pipe(
      switchMap(() => from(this.ratesService.getAllRates())),
      map((rates) => rates.filter((r) => !r.stale)),
      distinctUntilChanged(
        (prev, curr) =>
          prev.length === curr.length &&
          prev.every((p, i) => p.mid === curr[i]?.mid),
      ),
      map(
        (rates) =>
          ({
            data: {
              data: rates,
              count: rates.length,
              timestamp: new Date().toISOString(),
            },
          }) as MessageEvent,
      ),
    );
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

import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RATE_PROVIDER } from '../providers/rate-provider.interface';
import type { RateProvider } from '../providers/rate-provider.interface';
import { getRoutePolicy, QUOTE_TTL_SECONDS } from './route-policy';
import { parseAmountToMinor, formatMinorToDisplay } from '../common/validation.utils';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RATE_PROVIDER) private readonly rateProvider: RateProvider,
  ) {}

  /**
   * Generate a conversion quote
   */
  async createQuote(input: {
    sourceAsset: string;
    targetAsset: string;
    sourceAmount: string;
  }) {
    const route = getRoutePolicy(input.sourceAsset, input.targetAsset);
    if (!route) {
      throw new BadRequestException(
        `Route ${input.sourceAsset} → ${input.targetAsset} is not supported`,
      );
    }

    // Parse source amount to minor units
    const sourceDecimals = input.sourceAsset === 'KES' ? 2 : 8;
    const targetDecimals = input.targetAsset === 'BTC' ? 8 : 2;
    const sourceAmountMinor = parseAmountToMinor(input.sourceAmount, sourceDecimals);

    // Validate bounds
    if (sourceAmountMinor < route.minSourceMinor) {
      throw new BadRequestException(
        `Minimum amount is ${formatMinorToDisplay(route.minSourceMinor, sourceDecimals)} ${input.sourceAsset}`,
      );
    }
    if (sourceAmountMinor > route.maxSourceMinor) {
      throw new BadRequestException(
        `Maximum amount is ${formatMinorToDisplay(route.maxSourceMinor, sourceDecimals)} ${input.sourceAsset}`,
      );
    }

    // Get rate from provider
    const rateResult = await this.rateProvider.getRate(
      input.sourceAsset,
      input.targetAsset,
    );

    // Calculate fee (in source currency minor units)
    const feeRate = BigInt(Math.round(parseFloat(route.feePercent) * 100));
    const feeMinor = (sourceAmountMinor * feeRate) / BigInt(10_000);
    const netSourceMinor = sourceAmountMinor - feeMinor;

    // Calculate target amount
    // rate is expressed as "1 source = X target"
    // target_minor = net_source_minor * rate * (10^targetDecimals / 10^sourceDecimals)
    const rateParts = rateResult.rate.split('.');
    const rateIntStr = rateParts[0] ?? '0';
    const rateFracStr = (rateParts[1] ?? '').padEnd(18, '0');
    const rateScaled = BigInt(rateIntStr) * BigInt(10 ** 18) + BigInt(rateFracStr.slice(0, 18));

    // target_minor = netSource * rateScaled / 10^18 * 10^(targetDecimals-sourceDecimals)
    let targetAmountMinor: bigint;
    if (targetDecimals >= sourceDecimals) {
      targetAmountMinor =
        (netSourceMinor * rateScaled * BigInt(10 ** (targetDecimals - sourceDecimals))) /
        BigInt(10 ** 18);
    } else {
      targetAmountMinor =
        (netSourceMinor * rateScaled) /
        (BigInt(10 ** 18) * BigInt(10 ** (sourceDecimals - targetDecimals)));
    }

    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);

    const quote = await this.prisma.conversionQuote.create({
      data: {
        sourceAsset: input.sourceAsset,
        targetAsset: input.targetAsset,
        sourceAmountMinor,
        targetAmountMinor,
        rate: rateResult.rate,
        spread: rateResult.spread,
        feeMinor,
        feeCurrency: input.sourceAsset,
        status: 'READY',
        expiresAt,
      },
    });

    this.logger.log(
      `Quote created: ${quote.id} | ${input.sourceAmount} ${input.sourceAsset} → ${formatMinorToDisplay(targetAmountMinor, targetDecimals)} ${input.targetAsset}`,
    );

    return {
      quoteId: quote.id,
      sourceAsset: input.sourceAsset,
      targetAsset: input.targetAsset,
      sourceAmount: input.sourceAmount,
      targetAmount: formatMinorToDisplay(targetAmountMinor, targetDecimals),
      rate: rateResult.rate,
      fee: formatMinorToDisplay(feeMinor, sourceDecimals),
      spread: rateResult.spread,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Validate that a quote is still valid (not expired, not used)
   */
  async validateQuote(quoteId: string) {
    const quote = await this.prisma.conversionQuote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    if (quote.status === 'EXPIRED' || quote.expiresAt < new Date()) {
      // Mark as expired if not already
      if (quote.status !== 'EXPIRED') {
        await this.prisma.conversionQuote.update({
          where: { id: quoteId },
          data: { status: 'EXPIRED' },
        });
      }
      throw new BadRequestException('Quote has expired');
    }

    if (quote.status === 'CONFIRMED') {
      throw new BadRequestException('Quote has already been used');
    }

    return quote;
  }

  /**
   * Mark a quote as confirmed
   */
  async confirmQuote(quoteId: string) {
    return this.prisma.conversionQuote.update({
      where: { id: quoteId },
      data: { status: 'CONFIRMED' },
    });
  }
}

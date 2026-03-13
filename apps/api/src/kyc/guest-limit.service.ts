import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GUEST_LIMITS } from '../conversion/route-policy';

@Injectable()
export class GuestLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a guest profile has remaining daily/monthly limits
   * for a given amount (in minor units).
   */
  async checkLimits(
    guestProfileId: string,
    amountMinor: bigint,
  ): Promise<void> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sum completed sessions for this guest
    const [dailyResult, monthlyResult] = await Promise.all([
      this.prisma.conversionSession.aggregate({
        where: {
          guestProfileId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          createdAt: { gte: dayStart },
        },
        _sum: { sourceAmountMinor: true },
      }),
      this.prisma.conversionSession.aggregate({
        where: {
          guestProfileId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          createdAt: { gte: monthStart },
        },
        _sum: { sourceAmountMinor: true },
      }),
    ]);

    const dailyUsed = dailyResult._sum.sourceAmountMinor ?? BigInt(0);
    const monthlyUsed = monthlyResult._sum.sourceAmountMinor ?? BigInt(0);

    if (dailyUsed + amountMinor > GUEST_LIMITS.dailyMinor) {
      throw new ForbiddenException(
        'Daily guest limit exceeded (KES 100,000/day)',
      );
    }

    if (monthlyUsed + amountMinor > GUEST_LIMITS.monthlyMinor) {
      throw new ForbiddenException(
        'Monthly guest limit exceeded (KES 300,000/month)',
      );
    }
  }
}

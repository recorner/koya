import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VALID_STATE_TRANSITIONS, ConversionState } from '@koya/types';

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that a state transition is allowed.
   * Throws BadRequestException if invalid.
   */
  validateTransition(
    currentState: ConversionState,
    targetState: ConversionState,
  ): void {
    const allowedTargets = VALID_STATE_TRANSITIONS[currentState];
    if (!allowedTargets || !allowedTargets.includes(targetState)) {
      throw new BadRequestException(
        `Invalid state transition: ${currentState} → ${targetState}`,
      );
    }
  }

  /**
   * Check for duplicate active sessions with the same guest and route
   */
  async checkDuplicateSession(
    guestProfileId: string,
    sourceAsset: string,
    targetAsset: string,
  ): Promise<void> {
    const activeSessions = await this.prisma.conversionSession.count({
      where: {
        guestProfileId,
        sourceAsset,
        targetAsset,
        status: 'ACTIVE',
        currentState: {
          notIn: ['COMPLETED', 'FAILED', 'EXPIRED'],
        },
      },
    });

    if (activeSessions > 0) {
      throw new BadRequestException(
        'An active conversion session already exists for this guest',
      );
    }
  }
}

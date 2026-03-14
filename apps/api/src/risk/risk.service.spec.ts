import { RiskService } from './risk.service';
import { ConversionState } from '@koya/types';

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(() => {
    // Create with a mock PrismaService
    service = new RiskService({} as unknown as import('../prisma/prisma.service').PrismaService);
  });

  describe('validateTransition', () => {
    it('allows valid transitions', () => {
      expect(() =>
        service.validateTransition(
          ConversionState.QUOTE_CONFIRMED,
          ConversionState.IDENTITY_PENDING,
        ),
      ).not.toThrow();
    });

    it('allows transition to FAILED from most states', () => {
      expect(() =>
        service.validateTransition(
          ConversionState.PAYMENT_PENDING,
          ConversionState.FAILED,
        ),
      ).not.toThrow();
    });

    it('rejects invalid transitions', () => {
      expect(() =>
        service.validateTransition(
          ConversionState.INTENT_CAPTURED,
          ConversionState.COMPLETED,
        ),
      ).toThrow('Invalid state transition');
    });

    it('rejects transitions from terminal states', () => {
      expect(() =>
        service.validateTransition(
          ConversionState.COMPLETED,
          ConversionState.FAILED,
        ),
      ).toThrow('Invalid state transition');

      expect(() =>
        service.validateTransition(
          ConversionState.FAILED,
          ConversionState.COMPLETED,
        ),
      ).toThrow('Invalid state transition');
    });

    it('allows MANUAL_REVIEW → COMPLIANCE_PENDING', () => {
      expect(() =>
        service.validateTransition(
          ConversionState.MANUAL_REVIEW,
          ConversionState.COMPLIANCE_PENDING,
        ),
      ).not.toThrow();
    });
  });
});

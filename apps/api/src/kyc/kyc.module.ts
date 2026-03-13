import { Module } from '@nestjs/common';
import { GuestProfileService } from './guest-profile.service';
import { ComplianceService } from './compliance.service';
import { GuestLimitService } from './guest-limit.service';
import { IDENTITY_VERIFIER } from '../providers/identity-verifier.interface';
import { AML_SCREENER } from '../providers/aml-screener.interface';
import { MockIprsVerifier } from '../providers/mock-iprs.verifier';
import { MockAmlScreener } from '../providers/mock-aml.screener';

@Module({
  providers: [
    GuestProfileService,
    ComplianceService,
    GuestLimitService,
    { provide: IDENTITY_VERIFIER, useClass: MockIprsVerifier },
    { provide: AML_SCREENER, useClass: MockAmlScreener },
  ],
  exports: [GuestProfileService, ComplianceService, GuestLimitService],
})
export class KycModule {}

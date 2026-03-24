import { Module } from '@nestjs/common';
import { BriaModule } from '@koya/bria-adapter';
import { PsbtRetentionService } from './psbt-retention.service';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [BriaModule],
  providers: [PsbtRetentionService, ReconciliationService],
  exports: [ReconciliationService],
})
export class OpsModule {}

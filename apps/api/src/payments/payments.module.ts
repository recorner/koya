import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { MpesaService } from './mpesa.service';
import { MPESA_ADAPTER } from '../providers/mpesa-adapter.interface';
import { MockMpesaAdapter } from '../providers/mock-mpesa.adapter';

@Module({
  controllers: [PaymentsController],
  providers: [
    MpesaService,
    { provide: MPESA_ADAPTER, useClass: MockMpesaAdapter },
  ],
  exports: [MpesaService],
})
export class PaymentsModule {}

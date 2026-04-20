import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { ApiSecurityModule } from '../security/api-security.module';
import { ConversionModule } from '../conversion/conversion.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RatesModule } from '../rates/rates.module';
import { DfnsModule } from '../dfns/dfns.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { OpsModule } from '../ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    ApiSecurityModule,
    ConversionModule,
    MessagingModule,
    RatesModule,
    DfnsModule,
    WebhooksModule,
    OpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

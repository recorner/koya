import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BriaEventConsumerService } from './bria-event-consumer.service';

@Controller('internal/health')
@SkipThrottle()
export class BriaHealthController {
  constructor(private readonly briaEventConsumer: BriaEventConsumerService) {}

  @Get('bria')
  async check() {
    const status = this.briaEventConsumer.getConnectivityStatus();

    return {
      status: status.enabled ? (status.connected ? 'ok' : 'unhealthy') : 'disabled',
      ...status,
    };
  }
}

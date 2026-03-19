import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return this.appService.getHealth();
  }

  @Get('health/cache')
  cacheHealth() {
    return this.appService.getCacheHealth();
  }

  @Get('health/rates')
  ratesHealth() {
    return this.appService.getRatesHealth();
  }
}

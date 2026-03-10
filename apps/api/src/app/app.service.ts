import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'koya-api',
      timestamp: new Date().toISOString(),
    };
  }
}

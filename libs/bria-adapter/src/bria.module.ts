import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BriaClientService } from './bria-client.service';
import { BriaAdminService } from './bria-admin.service';

@Module({
  imports: [ConfigModule],
  providers: [BriaClientService, BriaAdminService],
  exports: [BriaClientService, BriaAdminService],
})
export class BriaModule {}

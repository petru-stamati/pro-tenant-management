import { Module } from '@nestjs/common';
import { TenantsController, TenantInvitesController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController, TenantInvitesController],
  providers: [TenantsService],
})
export class TenantsModule {}

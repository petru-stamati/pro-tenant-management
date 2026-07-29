import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AnalyticsService } from './analytics.service';
import { LeaseExpirationsQueryDto } from './dto/lease-expirations.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

class RevenueQueryDto {
  @IsIn(['month', 'owner'])
  groupBy: 'month' | 'owner' = 'month';
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('owner/:id/summary')
  @RequirePermission('analytics:read')
  ownerSummary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.analytics.ownerSummary(user, id);
  }

  @Get('admin/summary')
  @RequirePermission('analytics:read-global')
  adminSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.adminSummary(user);
  }

  @Get('revenue')
  @RequirePermission('analytics:read-global')
  revenue(@Query() query: RevenueQueryDto) {
    return this.analytics.revenue(query.groupBy);
  }

  @Get('lease-expirations')
  @RequirePermission('analytics:read')
  leaseExpirations(@CurrentUser() user: AuthenticatedUser, @Query() query: LeaseExpirationsQueryDto) {
    return this.analytics.leaseExpirations(user, query.withinDays, query.ownerId);
  }
}

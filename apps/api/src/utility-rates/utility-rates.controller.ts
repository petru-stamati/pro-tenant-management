import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UtilityRatesService } from './utility-rates.service';
import { UpsertUtilityRateDto } from './dto/upsert-utility-rate.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('utility-rates')
export class UtilityRatesController {
  constructor(private readonly rates: UtilityRatesService) {}

  @Get()
  @RequirePermission('utilities:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('ownerId') ownerId?: string) {
    return this.rates.list(user, ownerId);
  }

  @Post()
  @RequirePermission('utilities:write')
  upsert(@Body() dto: UpsertUtilityRateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rates.upsert(dto, user);
  }
}

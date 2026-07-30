import { Body, Controller, Get, Post } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { RecordExchangeRateDto } from './dto/record-exchange-rate.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRates: ExchangeRatesService) {}

  @Get()
  @RequirePermission('payments:read')
  list() {
    return this.exchangeRates.list();
  }

  // Intentionally no @RequirePermission — the rate is shown to every role
  // (PM/Owner/Tenant) in the sidebar, not gated behind the payments permission.
  @Get('latest')
  latest() {
    return this.exchangeRates.getLatest();
  }

  @Post()
  @RequirePermission('payments:write')
  record(@Body() dto: RecordExchangeRateDto) {
    return this.exchangeRates.record(dto);
  }

  @Post('fetch-latest')
  @RequirePermission('payments:write')
  fetchLatest() {
    return this.exchangeRates.fetchAndSaveFromBnr();
  }
}

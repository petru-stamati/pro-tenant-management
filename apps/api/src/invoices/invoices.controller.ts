import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermission('invoices:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvoicesDto) {
    return this.invoices.list(user, query);
  }

  @Get(':id')
  @RequirePermission('invoices:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoices.findOne(user, id);
  }

  @Post(':id/void')
  @RequirePermission('payments:write')
  void(@Param('id') id: string) {
    return this.invoices.void(id);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RentPaymentsService } from './rent-payments.service';
import { CreateRentPaymentDto } from './dto/create-rent-payment.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ListRentPaymentsDto } from './dto/list-rent-payments.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('rent-payments')
export class RentPaymentsController {
  constructor(private readonly rentPayments: RentPaymentsService) {}

  @Get()
  @RequirePermission('payments:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListRentPaymentsDto) {
    return this.rentPayments.list(user, query);
  }

  @Get(':id')
  @RequirePermission('payments:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rentPayments.findOne(user, id);
  }

  @Post()
  @RequirePermission('payments:write')
  create(@Body() dto: CreateRentPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentPayments.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('payments:write')
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.rentPayments.recordPayment(id, dto);
  }

  @Post(':id/generate-invoice')
  @RequirePermission('payments:write')
  generateInvoice(@Param('id') id: string) {
    return this.rentPayments.generateInvoice(id);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PaymentConfirmationsService } from './payment-confirmations.service';
import { CreatePaymentConfirmationDto } from './dto/create-payment-confirmation.dto';
import { ListPaymentConfirmationsDto } from './dto/list-payment-confirmations.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('payment-confirmations')
export class PaymentConfirmationsController {
  constructor(private readonly confirmations: PaymentConfirmationsService) {}

  @Get()
  @RequirePermission('payments:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPaymentConfirmationsDto) {
    return this.confirmations.list(user, query);
  }

  @Post()
  @RequirePermission('payments:write')
  create(@Body() dto: CreatePaymentConfirmationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.confirmations.create(dto, user);
  }

  @Delete(':id')
  @RequirePermission('payments:write')
  remove(@Param('id') id: string) {
    return this.confirmations.remove(id);
  }
}

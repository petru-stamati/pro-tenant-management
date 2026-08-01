import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApartmentInvoicesService } from './apartment-invoices.service';
import { CreateApartmentInvoiceDto } from './dto/create-apartment-invoice.dto';
import { UpdateApartmentInvoiceDto } from './dto/update-apartment-invoice.dto';
import { ListApartmentInvoicesDto } from './dto/list-apartment-invoices.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('apartment-invoices')
export class ApartmentInvoicesController {
  constructor(private readonly invoices: ApartmentInvoicesService) {}

  @Get()
  @RequirePermission('invoices:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListApartmentInvoicesDto) {
    return this.invoices.list(user, query);
  }

  @Post()
  @RequirePermission('invoices:write')
  create(@Body() dto: CreateApartmentInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('invoices:write')
  update(@Param('id') id: string, @Body() dto: UpdateApartmentInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('invoices:write')
  remove(@Param('id') id: string) {
    return this.invoices.remove(id);
  }
}

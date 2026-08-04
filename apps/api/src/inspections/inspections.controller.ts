import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { RecordInspectionResultDto } from './dto/record-inspection-result.dto';
import { CompleteInspectionDto } from './dto/complete-inspection.dto';
import { ListInspectionsDto } from './dto/list-inspections.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get()
  @RequirePermission('inspections:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInspectionsDto) {
    return this.inspections.list(user, query.apartmentId);
  }

  @Get(':id')
  @RequirePermission('inspections:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.inspections.findOne(user, id);
  }

  @Post()
  @RequirePermission('inspections:write')
  start(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inspections.startOrResume(dto, user);
  }

  @Post(':id/results')
  @RequirePermission('inspections:write')
  recordResult(@Param('id') id: string, @Body() dto: RecordInspectionResultDto) {
    return this.inspections.recordResult(id, dto);
  }

  @Post(':id/complete')
  @RequirePermission('inspections:write')
  complete(@Param('id') id: string, @Body() dto: CompleteInspectionDto) {
    return this.inspections.complete(id, dto);
  }
}

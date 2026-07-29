import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { ProposalDecisionDto } from './dto/proposal-decision.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('maintenance-requests')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @RequirePermission('maintenance:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListMaintenanceRequestsDto) {
    return this.maintenance.list(user, query);
  }

  @Get(':id')
  @RequirePermission('maintenance:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.maintenance.findOne(user, id);
  }

  @Post()
  @RequirePermission('maintenance:report')
  create(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('maintenance:manage')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRequestDto) {
    return this.maintenance.update(id, dto);
  }

  @Post(':id/status')
  @RequirePermission('maintenance:manage')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.changeStatus(id, dto, user);
  }

  @Post(':id/cancel')
  @RequirePermission('maintenance:manage')
  cancel(@Param('id') id: string, @Body() dto: CancelRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.cancel(id, dto.reason, user);
  }

  @Post(':id/proposals')
  @RequirePermission('maintenance:manage')
  createProposal(@Param('id') id: string, @Body() dto: CreateProposalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.createProposal(id, dto, user);
  }

  @Post(':id/proposals/:proposalId/decision')
  @RequirePermission('maintenance:approve')
  decideProposal(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @Body() dto: ProposalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenance.decideProposal(id, proposalId, dto.decision, user);
  }

  @Get(':id/comments')
  @RequirePermission('maintenance:read')
  listComments(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.maintenance.listComments(user, id);
  }

  @Post(':id/comments')
  @RequirePermission('maintenance:comment')
  createComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.createComment(id, dto, user);
  }
}

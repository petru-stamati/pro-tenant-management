import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CompleteLeaseSigningDto } from './dto/complete-lease-signing.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('tasks:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTasksDto) {
    return this.tasks.list(user, query);
  }

  @Get(':id')
  @RequirePermission('tasks:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasks.findOne(user, id);
  }

  @Post()
  @RequirePermission('tasks:write')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('tasks:write')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user, id, dto);
  }

  @Post(':id/comments')
  @RequirePermission('tasks:write')
  createComment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTaskCommentDto) {
    return this.tasks.createComment(user, id, dto);
  }

  @Post(':id/complete-lease-signing')
  @RequirePermission('tasks:write')
  completeLeaseSigning(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteLeaseSigningDto,
  ) {
    return this.tasks.completeLeaseSigning(user, id, dto);
  }
}

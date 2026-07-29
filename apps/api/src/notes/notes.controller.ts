import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('apartments/:apartmentId/notes')
export class ApartmentNotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @RequirePermission('notes:read')
  list(@Param('apartmentId') apartmentId: string) {
    return this.notes.listForApartment(apartmentId);
  }

  @Post()
  @RequirePermission('notes:write')
  create(@Param('apartmentId') apartmentId: string, @Body() dto: CreateNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notes.create(apartmentId, dto, user);
  }
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Delete(':id')
  @RequirePermission('notes:write')
  remove(@Param('id') id: string) {
    return this.notes.remove(id);
  }
}

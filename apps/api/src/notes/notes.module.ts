import { Module } from '@nestjs/common';
import { ApartmentNotesController, NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  controllers: [ApartmentNotesController, NotesController],
  providers: [NotesService],
})
export class NotesModule {}

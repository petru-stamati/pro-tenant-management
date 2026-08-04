import { Module } from '@nestjs/common';
import { RoomsController, RoomItemsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RoomsController, RoomItemsController],
  providers: [RoomsService],
})
export class RoomsModule {}

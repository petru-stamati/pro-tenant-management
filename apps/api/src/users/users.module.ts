import { Module } from '@nestjs/common';
import { UsersController, RolesPermissionsController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for PermissionsService
  controllers: [UsersController, RolesPermissionsController],
  providers: [UsersService],
})
export class UsersModule {}

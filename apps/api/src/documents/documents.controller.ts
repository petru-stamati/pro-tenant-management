import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { AssignInvoiceDto } from './dto/assign-invoice.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission('documents:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListDocumentsDto) {
    return this.documents.list(user, query);
  }

  @Get(':id')
  @RequirePermission('documents:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.findOne(user, id);
  }

  @Get(':id/download')
  @RequirePermission('documents:read')
  async download(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName, mimeType } = await this.documents.downloadBuffer(user, id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @Post('upload-url')
  @RequirePermission('documents:write')
  createUploadUrl(@Body() dto: CreateUploadUrlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.createUploadUrl(dto, user);
  }

  // Dev-only stand-in for a direct-to-S3 presigned PUT (see local-storage.service.ts).
  @Post(':id/raw-upload')
  @RequirePermission('documents:write')
  @UseInterceptors(FileInterceptor('file'))
  receiveUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documents.receiveUpload(user, id, file.buffer);
  }

  @Post(':id/complete')
  @RequirePermission('documents:write')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.complete(user, id);
  }

  @Post(':id/new-version')
  @RequirePermission('documents:write')
  newVersion(@Param('id') id: string, @Body() dto: CreateUploadUrlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.newVersion(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('documents:write')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.remove(user, id);
  }

  @Patch(':id/assign-invoice')
  @RequirePermission('invoices:write')
  assignInvoice(@Param('id') id: string, @Body() dto: AssignInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.assignInvoice(id, dto, user);
  }
}

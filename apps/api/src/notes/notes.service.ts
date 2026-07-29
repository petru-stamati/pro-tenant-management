import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateNoteDto } from './dto/create-note.dto';

/**
 * Never reachable by an Owner/Tenant token — enforced here (only ADMIN has
 * notes:read/notes:write in the Phase 4 catalog) and structurally, since
 * this service is never imported by anything Owner/Tenant-facing (PRD §4.10).
 */
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForApartment(apartmentId: string) {
    return this.prisma.client.note.findMany({
      where: { apartmentId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async create(apartmentId: string, dto: CreateNoteDto, author: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');
    return this.prisma.client.note.create({
      data: { apartmentId, ownerId: apartment.ownerId, body: dto.body, authorId: author.id },
    });
  }

  async remove(id: string) {
    const note = await this.prisma.client.note.findFirst({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.client.note.delete({ where: { id } });
    return { success: true };
  }
}

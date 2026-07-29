import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordExchangeRateDto } from './dto/record-exchange-rate.dto';

/**
 * Manual entry for now — Phase 1's daily BNR-fetch background job needs
 * Redis/BullMQ, which isn't provisioned on this machine yet (see
 * packages/db/README.md). This service is the seam that job will write
 * into; nothing else needs to change when it's wired up.
 */
@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 100 });
  }

  async record(dto: RecordExchangeRateDto) {
    const date = new Date(dto.date);
    return this.prisma.client.exchangeRate.upsert({
      where: { date },
      update: { rateRON: dto.rateRON, source: 'MANUAL' },
      create: { date, rateRON: dto.rateRON, source: 'MANUAL' },
    });
  }

  /** The rate in effect on `date` — the most recent recorded rate on or before it. */
  async getRateForDate(date: Date) {
    const rate = await this.prisma.client.exchangeRate.findFirst({
      where: { date: { lte: date } },
      orderBy: { date: 'desc' },
    });
    if (!rate) {
      throw new NotFoundException(
        'No BNR exchange rate on file for or before this date — record one via POST /exchange-rates first.',
      );
    }
    return rate;
  }
}

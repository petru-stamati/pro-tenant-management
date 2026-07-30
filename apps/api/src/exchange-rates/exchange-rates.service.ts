import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RecordExchangeRateDto } from './dto/record-exchange-rate.dto';

const BNR_FEED_URL = 'https://www.bnr.ro/nbrfxrates.xml';

/**
 * Manual entry stays available as a fallback, but the primary path is now
 * this daily auto-fetch from BNR's own official rate feed (not a
 * third-party site scrape — same numbers, but a stable, intended-for-
 * programmatic-use source that won't break if some site's HTML changes).
 */
@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 100 });
  }

  async getLatest() {
    const rate = await this.prisma.client.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
    if (!rate) throw new NotFoundException('No exchange rate on file yet');
    return rate;
  }

  async record(dto: RecordExchangeRateDto) {
    const date = new Date(dto.date);
    return this.prisma.client.exchangeRate.upsert({
      where: { date },
      update: { rateRON: dto.rateRON, source: 'MANUAL' },
      create: { date, rateRON: dto.rateRON, source: 'MANUAL' },
    });
  }

  /** BNR publishes weekday updates after ~13:00 Bucharest time — checked a few times in that window for resilience against a late publish. */
  @Cron('0 5,15,30,45 13-16 * * 1-5', { timeZone: 'Europe/Bucharest' })
  async scheduledFetch() {
    try {
      const result = await this.fetchAndSaveFromBnr();
      this.logger.log(`BNR rate updated: ${result.date.toISOString().slice(0, 10)} = ${result.rateRON} RON/EUR`);
    } catch (err) {
      this.logger.error(`BNR rate auto-fetch failed: ${(err as Error).message}`);
    }
  }

  /** Fetches today's rate from BNR's official feed and saves it. Also callable on demand (manual "refresh now" / retry after a failed scheduled run). */
  async fetchAndSaveFromBnr() {
    const res = await fetch(BNR_FEED_URL);
    if (!res.ok) throw new BadRequestException(`BNR feed returned ${res.status}`);
    const xml = await res.text();

    const dateMatch = xml.match(/<Cube date="(\d{4}-\d{2}-\d{2})"/);
    const eurMatch = xml.match(/<Rate currency="EUR">([\d.]+)<\/Rate>/);
    if (!dateMatch || !eurMatch) {
      throw new BadRequestException('Could not find a EUR rate in the BNR feed — its format may have changed');
    }

    const date = new Date(dateMatch[1]);
    const rateRON = parseFloat(eurMatch[1]);

    return this.prisma.client.exchangeRate.upsert({
      where: { date },
      update: { rateRON, source: 'BNR' },
      create: { date, rateRON, source: 'BNR' },
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

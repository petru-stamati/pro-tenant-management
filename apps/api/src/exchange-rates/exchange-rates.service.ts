import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RecordExchangeRateDto } from './dto/record-exchange-rate.dto';

// BNR migrated this feed to a dedicated subdomain — the old www.bnr.ro path
// now 302s to their homepage instead of erroring, which silently broke
// parsing (regex found no <Cube>/<Rate> tags in what was actually HTML).
// See https://www.bnr.ro/en/24006-exchange-rate-list-in-xml-format.
const BNR_FEED_URL = 'https://curs.bnr.ro/nbrfxrates.xml';

/**
 * Manual entry stays available as a fallback, but the primary path is now
 * this daily auto-fetch from BNR's own official rate feed (not a
 * third-party site scrape — same numbers, but a stable, intended-for-
 * programmatic-use source that won't break if some site's HTML changes).
 */
const AUTO_REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // don't hammer the BNR feed more than once an hour

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private lastAutoRefreshAttempt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 100 });
  }

  /**
   * Render's free tier sleeps after ~15 min idle, and the scheduled cron
   * below is an in-process timer — it simply never fires while the process
   * is asleep, which it often is during the 13:00-16:00 Bucharest window
   * this app gets checked outside of. Rather than depend on the process
   * being awake at exactly the right minute, treat every read as a chance
   * to self-heal: if the cached rate isn't from today, try a live refresh
   * (throttled) before answering, so normal traffic keeps it current
   * instead of a narrow cron window.
   */
  async getLatest() {
    const rate = await this.prisma.client.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
    if (!rate) throw new NotFoundException('No exchange rate on file yet');

    if (this.isStale(rate.date)) {
      const refreshed = await this.tryAutoRefresh();
      if (refreshed) return refreshed;
    }
    return rate;
  }

  private isStale(date: Date): boolean {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });
    return date.toISOString().slice(0, 10) !== today;
  }

  private async tryAutoRefresh() {
    const now = Date.now();
    if (now - this.lastAutoRefreshAttempt < AUTO_REFRESH_COOLDOWN_MS) return null;
    this.lastAutoRefreshAttempt = now;
    try {
      return await this.fetchAndSaveFromBnr();
    } catch (err) {
      // Expected on weekends/holidays (BNR hasn't published a new one) or a transient
      // network blip — the stale-but-real rate we already have is still a fine answer.
      this.logger.error(`On-demand BNR refresh failed: ${(err as Error).message}`);
      return null;
    }
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
      // Most likely cause: a redirect landed on an HTML page instead of the XML feed
      // (this happened once already when BNR moved the feed to curs.bnr.ro) — call
      // that out specifically since "wrong URL" is a much faster fix than "format changed".
      const looksLikeHtml = /<!DOCTYPE html|<html[\s>]/i.test(xml);
      throw new BadRequestException(
        looksLikeHtml
          ? `BNR feed URL returned an HTML page instead of XML (redirected?) — check ${BNR_FEED_URL} still points at the real feed`
          : 'Could not find a EUR rate in the BNR feed — its format may have changed',
      );
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

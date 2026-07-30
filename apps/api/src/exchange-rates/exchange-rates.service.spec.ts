import { BadRequestException } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';

const SAMPLE_BNR_XML = `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd"><Header><Publisher>National Bank of Romania</Publisher><PublishingDate>2026-07-30</PublishingDate></Header><Body><Cube date="2026-07-30"><Rate currency="AED">1.2452</Rate><Rate currency="EUR">5.2439</Rate><Rate currency="USD">4.5732</Rate></Cube></Body></DataSet>`;

function makePrisma() {
  return {
    client: {
      exchangeRate: {
        upsert: jest.fn((args) => ({ id: 'rate-1', ...args.create })),
        findFirst: jest.fn(),
      },
    },
  };
}

describe('ExchangeRatesService.fetchAndSaveFromBnr', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses the EUR rate and date out of the real BNR XML shape and upserts with source BNR', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_BNR_XML }) as never;
    const prisma = makePrisma();
    const service = new ExchangeRatesService(prisma as never);

    const result = await service.fetchAndSaveFromBnr();

    expect(prisma.client.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: new Date('2026-07-30') },
        create: expect.objectContaining({ rateRON: 5.2439, source: 'BNR' }),
        update: expect.objectContaining({ rateRON: 5.2439, source: 'BNR' }),
      }),
    );
    expect(result).toMatchObject({ rateRON: 5.2439, source: 'BNR' });
  });

  it('throws when the feed is unreachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as never;
    const prisma = makePrisma();
    const service = new ExchangeRatesService(prisma as never);

    await expect(service.fetchAndSaveFromBnr()).rejects.toThrow(BadRequestException);
  });

  it('throws a clear error if the feed format changes and EUR can no longer be found', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '<DataSet></DataSet>' }) as never;
    const prisma = makePrisma();
    const service = new ExchangeRatesService(prisma as never);

    await expect(service.fetchAndSaveFromBnr()).rejects.toThrow('Could not find a EUR rate');
  });
});

describe('ExchangeRatesService.getLatest', () => {
  it('returns the most recent rate on file', async () => {
    const prisma = makePrisma();
    prisma.client.exchangeRate.findFirst.mockResolvedValue({ date: new Date('2026-07-30'), rateRON: '5.2439' });
    const service = new ExchangeRatesService(prisma as never);

    const result = await service.getLatest();
    expect(result).toMatchObject({ rateRON: '5.2439' });
    expect(prisma.client.exchangeRate.findFirst).toHaveBeenCalledWith({ orderBy: { date: 'desc' } });
  });

  it('throws NotFoundException when nothing is on file yet', async () => {
    const prisma = makePrisma();
    prisma.client.exchangeRate.findFirst.mockResolvedValue(null);
    const service = new ExchangeRatesService(prisma as never);

    await expect(service.getLatest()).rejects.toThrow('No exchange rate on file yet');
  });
});

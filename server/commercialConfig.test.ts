import { afterEach, describe, expect, it } from 'vitest';
import { normalizeCommercialConfig } from './commercialConfig';

const originalCurrency = process.env.BOLD_CURRENCY;

afterEach(() => {
  if (originalCurrency === undefined) delete process.env.BOLD_CURRENCY;
  else process.env.BOLD_CURRENCY = originalCurrency;
});

describe('normalizeCommercialConfig', () => {
  it('keeps USD as the default when a legacy config has no currency', () => {
    delete process.env.BOLD_CURRENCY;
    expect(normalizeCommercialConfig({}).currency).toBe('USD');
  });

  it('respects an explicit supported currency', () => {
    expect(normalizeCommercialConfig({ currency: 'COP' }).currency).toBe('COP');
    expect(normalizeCommercialConfig({ currency: 'USD' }).currency).toBe('USD');
  });

  it('sanitizes public announcement and pricing values', () => {
    const normalized = normalizeCommercialConfig({
      freeGenerations: 999,
      announcement: {
        enabled: true,
        text: `  ${'a'.repeat(300)}  `,
        tone: 'warning',
        linkLabel: 'b'.repeat(80),
        linkUrl: 'javascript:alert(1)'
      },
      plans: {
        payg: { enabled: true, baseAmount: -5, displayPriceUsd: -2, discountPercent: 180 }
      } as any
    });

    expect(normalized.freeGenerations).toBe(100);
    expect(normalized.announcement.text).toHaveLength(240);
    expect(normalized.announcement.linkLabel).toHaveLength(40);
    expect(normalized.announcement.linkUrl).toBe('');
    expect(normalized.plans.payg.baseAmount).toBe(1);
    expect(normalized.plans.payg.displayPriceUsd).toBe(0);
    expect(normalized.plans.payg.discountPercent).toBe(100);
  });
});

import { describe, expect, it } from 'vitest';
import {
  enrichOptionRecord,
  isOptionTrade,
  optionExpiryDate,
  resolveOptionMeta,
} from './optionRecord.js';

describe('option record metadata', () => {
  it('derives structured metadata from a legacy asset name', () => {
    expect(resolveOptionMeta({
      symbol: 'onds',
      assetClass: 'Option',
      assetName: 'ONDS 24 Apr26 9.5 Call',
    })).toEqual({
      underlying: 'ONDS',
      optionType: 'call',
      strike: 9.5,
      expiry: '2026-04-24',
    });
  });

  it('prefers and normalizes explicit structured fields', () => {
    const record = enrichOptionRecord({
      symbol: 'AAPL',
      assetClass: 'option',
      assetName: 'legacy name',
      underlying: ' msft ',
      optionType: 'PUT',
      strike: '420',
      expiry: '2026/09/18',
    });

    expect(record).toMatchObject({
      assetClass: 'Option',
      underlying: 'MSFT',
      optionType: 'put',
      strike: 420,
      expiry: '2026-09-18',
    });
    expect(record.assetName).toBe('legacy name');
  });

  it('keeps incomplete option records usable without inventing metadata', () => {
    const record = enrichOptionRecord({
      symbol: 'NVDA',
      assetClass: 'Option',
      assetName: 'NVDA unknown contract',
      multiplier: 100,
    });

    expect(record).toMatchObject({ underlying: 'NVDA', assetClass: 'Option' });
    expect(record.optionType).toBeUndefined();
    expect(record.strike).toBeUndefined();
    expect(record.expiry).toBeUndefined();
    expect(isOptionTrade(record)).toBe(true);
  });

  it('falls back to symbol when an explicit underlying is blank', () => {
    expect(resolveOptionMeta({
      symbol: 'tsla',
      underlying: '   ',
      assetClass: 'Option',
    }).underlying).toBe('TSLA');
  });

  it('converts expiry to a local calendar date and preserves legacy fallback', () => {
    const date = optionExpiryDate({ expiry: '2027-01-15', assetClass: 'Option' });
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 0, 15]);
    expect(optionExpiryDate({ assetClass: 'Option' }).getFullYear()).toBe(2099);
  });
});

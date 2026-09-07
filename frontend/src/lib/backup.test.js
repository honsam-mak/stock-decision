import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup } from './backup.js';

describe('backup v1.1', () => {
  it('round-trips collections, canonical IDs, and omits secrets', () => {
    const backup = createBackup({
      stocks: [{ id: 'stock-1', symbol: ' nvda ', name: 'NVIDIA' }],
      simulations: [{ id: 'sim-1', symbol: 'nvda' }],
      records: [{ symbol: ' nvda ', action: 'BUY', qty: 1, sourceTradeId: ' open-1 ' }],
      userSettings: { lang: 'zh', alphaVantageKey: 'secret' },
      performanceSettings: { order: ['gain'] },
      marketDataCache: [{ id: 'nvda', symbol: 'nvda', history: [] }],
    });

    expect(backup.version).toBe('1.1');
    expect(backup.userSettings).toEqual({ lang: 'zh' });
    expect(JSON.stringify(backup)).not.toContain('secret');
    expect(backup.canonicalIds.stocks.NVDA).toBe('stock-1');

    const first = parseBackup(backup);
    const second = parseBackup(backup);
    const record = first.operations.find((operation) => operation.collection === 'records');
    expect(record.id).toMatch(/^record-/);
    expect(record.id).toBe(second.operations.find((operation) => operation.collection === 'records').id);
    expect(record.data).toMatchObject({ symbol: 'NVDA', sourceTradeId: 'open-1' });
    expect(first.summary).toMatchObject({
      version: '1.1',
      stocks: 1,
      simulations: 1,
      records: 1,
      marketDataCache: 1,
    });
    expect(first.operations.every((operation) => operation.merge)).toBe(true);
  });

  it('round-trips structured option metadata', () => {
    const backup = createBackup({
      records: [{
        id: 'option-1',
        symbol: 'aapl',
        assetClass: 'Option',
        assetName: 'AAPL 18 Sep26 250 Call',
        action: 'Buy',
        qty: 2,
        price: 4.5,
        multiplier: 100,
        underlying: 'aapl',
        optionType: 'CALL',
        strike: 250,
        expiry: '2026/09/18',
      }],
    });

    const operation = parseBackup(backup).operations.find(({ collection }) => collection === 'records');
    expect(operation.data).toMatchObject({
      id: 'option-1',
      symbol: 'AAPL',
      underlying: 'AAPL',
      optionType: 'call',
      strike: 250,
      expiry: '2026-09-18',
    });
  });
});

describe('legacy backup import', () => {
  it('supports v1.0 and keeps existing setting keys', () => {
    const result = parseBackup({
      version: '1.0',
      stocks: [{ symbol: ' tsla ' }],
      records: [{ symbol: 'tsla', action: 'BUY', qty: 2 }],
      userSettings: { lang: 'en', theme: 'dark', alphaVantageKey: 'old-secret' },
      performanceSettings: { order: ['loss'], density: 'compact' },
    }, {
      existingUserSettings: { lang: 'zh' },
      existingPerformanceSettings: { order: ['gain'] },
    });

    expect(result.operations.find((operation) => operation.id === 'api')?.data).toEqual({ theme: 'dark' });
    expect(result.operations.find((operation) => operation.id === 'performance')?.data).toEqual({ density: 'compact' });
    expect(result.operations.find((operation) => operation.collection === 'stocks')).toMatchObject({
      id: 'TSLA',
      data: { symbol: 'TSLA' },
    });
  });

  it('supports unversioned backups and rejects malformed collections', () => {
    expect(parseBackup({ records: [{ symbol: 'amd', action: 'BUY' }] }).summary.version).toBe('unversioned');
    expect(() => parseBackup({ version: '1.0', records: {} })).toThrow('records must be an array');
    expect(() => parseBackup({ version: '2.0', stocks: [] })).toThrow('Unsupported backup version');
  });

  it('enriches legacy option records without changing deterministic IDs', () => {
    const root = {
      version: '1.0',
      records: [{
        symbol: 'onds',
        assetClass: 'Option',
        assetName: 'ONDS 24 Apr26 9.5 Call',
        action: 'Buy',
        qty: 1,
        price: 0.5,
        multiplier: 100,
      }],
    };

    const first = parseBackup(root).operations[0];
    const second = parseBackup(root).operations[0];
    expect(first.id).toBe(second.id);
    expect(first.data).toMatchObject({
      underlying: 'ONDS',
      optionType: 'call',
      strike: 9.5,
      expiry: '2026-04-24',
    });
  });

  it('keeps duplicate legacy records as separate deterministic documents', () => {
    const record = { symbol: 'amd', action: 'Buy', qty: 1, price: 100 };
    const result = parseBackup({
      version: '1.0',
      records: [{ ...record }, { ...record }],
    });
    const ids = result.operations.map(({ id }) => id);

    expect(new Set(ids).size).toBe(2);
    expect(ids[1]).toBe(`${ids[0]}-2`);
    expect(parseBackup({
      version: '1.0',
      records: [{ ...record }, { ...record }],
    }).operations.map(({ id }) => id)).toEqual(ids);
  });
});

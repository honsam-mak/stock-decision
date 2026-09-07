import { describe, expect, it } from 'vitest';
import {
  aggregateOptionPosition,
  matchOptionContract,
  optionContractKey,
  positionKeys,
} from './optionChain.js';

const record = {
  symbol: 'AAPL',
  assetClass: 'Option',
  assetName: 'AAPL 18 Sep26 250 Call',
  underlying: 'AAPL',
  optionType: 'call',
  strike: 250,
  expiry: '2026-09-18',
};

const chain = {
  calls: [{
    contractSymbol: 'AAPL260918C00250000',
    optionType: 'call',
    strike: 250,
    expiry: '2026-09-18',
    mark: 9,
  }],
  puts: [],
};

describe('option chain matching', () => {
  it('builds stable keys from structured and legacy records', () => {
    expect(optionContractKey(record)).toBe('AAPL:2026-09-18:250.0000:call');
    expect(optionContractKey({
      symbol: 'AAPL',
      assetClass: 'Option',
      assetName: 'AAPL 18 Sep26 250 Call',
    })).toBe(optionContractKey(record));
  });

  it('matches the corresponding contract and rejects a different expiry', () => {
    expect(matchOptionContract(chain, record)?.mark).toBe(9);
    expect(matchOptionContract(chain, { ...record, expiry: '2026-10-16' })).toBeNull();
    expect(matchOptionContract(chain, null)).toBeNull();
  });

  it('collects held contract keys', () => {
    expect(positionKeys([
      { ...record, action: 'Buy', openQty: 1 },
      { assetClass: 'Stock', symbol: 'MSFT' },
    ]).has(
      optionContractKey(record),
    )).toBe(true);
  });

  it('nets opposite lots and derives an equivalent premium', () => {
    const long = { ...record, action: 'Buy', openQty: 3, price: 5 };
    const short = { ...record, assetName: 'alternate display name', action: 'Sell', openQty: 1, price: 7 };
    const aggregate = aggregateOptionPosition([long, short], optionContractKey(record));

    expect(aggregate).toMatchObject({
      action: 'Buy',
      openQty: 2,
      qty: 2,
      price: 4,
    });
    expect(aggregateOptionPosition([
      { ...long, openQty: 1 },
      { ...short, openQty: 1 },
    ], optionContractKey(record))).toBeNull();
  });
});

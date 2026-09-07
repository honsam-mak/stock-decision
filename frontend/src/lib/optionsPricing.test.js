import { describe, expect, it } from 'vitest';
import {
  blackScholesPrice,
  calculateGreeks,
  impliedVolatility,
  normCDF,
  optionTimeValue,
  yearsToExpiry,
} from './optionsPricing.js';

describe('Black-Scholes option pricing', () => {
  const config = {
    spot: 100,
    strike: 100,
    time: 1,
    rate: 0.05,
    dividendYield: 0,
    volatility: 0.2,
  };

  it('matches known call and put prices', () => {
    expect(blackScholesPrice({ ...config, optionType: 'call' })).toBeCloseTo(10.4506, 3);
    expect(blackScholesPrice({ ...config, optionType: 'put' })).toBeCloseTo(5.5735, 3);
    expect(normCDF(0)).toBeCloseTo(0.5, 6);
  });

  it('returns intrinsic value at expiry', () => {
    expect(blackScholesPrice({
      spot: 110, strike: 100, time: 0, optionType: 'call',
    })).toBe(10);
    expect(blackScholesPrice({
      spot: 90, strike: 100, time: 0, optionType: 'put',
    })).toBe(10);
  });

  it('round-trips implied volatility', () => {
    const marketPrice = blackScholesPrice({ ...config, optionType: 'call' });
    const iv = impliedVolatility(marketPrice, {
      ...config,
      volatility: undefined,
      optionType: 'call',
    });
    expect(iv).toBeCloseTo(0.2, 4);
  });

  it('calculates Greeks with expected signs', () => {
    const call = calculateGreeks({ ...config, optionType: 'call' });
    const put = calculateGreeks({ ...config, optionType: 'put' });
    expect(call.delta).toBeGreaterThan(0);
    expect(put.delta).toBeLessThan(0);
    expect(call.gamma).toBeGreaterThan(0);
    expect(call.theta).toBeLessThan(0);
    expect(call.vega).toBeGreaterThan(0);
  });

  it('handles time and time value boundaries', () => {
    expect(yearsToExpiry('2026-09-08', new Date('2026-09-07T00:00:00'))).toBeGreaterThan(0);
    expect(yearsToExpiry('2026-09-01', new Date('2026-09-07T00:00:00'))).toBe(0);
    expect(optionTimeValue(8, 5)).toBe(3);
    expect(optionTimeValue(4, 5)).toBe(0);
    expect(optionTimeValue(null, 5)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildScenarioPnL,
  buildTimeDecaySeries,
  buildValuationScenario,
  calcBreakeven,
  calcExpiryPnL,
  calcMarkToMarketPnL,
  classifyMoneyness,
  getExerciseImpact,
} from './payoff.js';

describe('option expiry analysis', () => {
  it('calculates call and put breakeven prices', () => {
    expect(calcBreakeven({ optionType: 'call', strike: 100, premium: 4.5 })).toBe(104.5);
    expect(calcBreakeven({ optionType: 'put', strike: 100, premium: 4.5 })).toBe(95.5);
  });

  it('calculates long and short call PnL at expiry', () => {
    const config = {
      optionType: 'call',
      strike: 100,
      premium: 5,
      underlyingPrice: 110,
      qty: 2,
      multiplier: 100,
    };
    expect(calcExpiryPnL({ ...config, direction: 'long' })).toBe(1000);
    expect(calcExpiryPnL({ ...config, direction: 'short' })).toBe(-1000);
  });

  it('calculates long and short put PnL at expiry', () => {
    const config = {
      optionType: 'put',
      strike: 50,
      premium: 2,
      underlyingPrice: 45,
      qty: 1,
      multiplier: 100,
    };
    expect(calcExpiryPnL({ ...config, direction: 'long' })).toBe(300);
    expect(calcExpiryPnL({ ...config, direction: 'short' })).toBe(-300);
  });

  it('classifies moneyness including the ATM tolerance', () => {
    expect(classifyMoneyness({ optionType: 'call', strike: 100, underlyingPrice: 101 })).toBe('ITM');
    expect(classifyMoneyness({ optionType: 'put', strike: 100, underlyingPrice: 101 })).toBe('OTM');
    expect(classifyMoneyness({ optionType: 'call', strike: 100, underlyingPrice: 100.4 })).toBe('ATM');
    expect(classifyMoneyness({ optionType: 'call', strike: 100, underlyingPrice: null })).toBeNull();
    expect(calcExpiryPnL({ optionType: 'call', strike: 100, premium: 5, underlyingPrice: '' })).toBeNull();
  });

  it('builds scenarios and exercise share/cash impact', () => {
    expect(buildScenarioPnL({
      optionType: 'call',
      strike: 100,
      premium: 5,
      direction: 'long',
      qty: 1,
      multiplier: 100,
    }, [90, 105, 110])).toEqual([
      { underlyingPrice: 90, pnl: -500 },
      { underlyingPrice: 105, pnl: 0 },
      { underlyingPrice: 110, pnl: 500 },
    ]);

    expect(getExerciseImpact({
      optionType: 'put',
      direction: 'short',
      strike: 50,
      qty: 2,
      multiplier: 100,
    })).toEqual({ action: 'Buy', shares: 200, cashFlow: -10000 });
  });

  it('calculates mark PnL and pre-expiry scenario curves', () => {
    expect(calcMarkToMarketPnL({
      premium: 5, markPrice: 7, direction: 'long', qty: 2, multiplier: 100,
    })).toBe(400);
    expect(calcMarkToMarketPnL({
      premium: 5, markPrice: 7, direction: 'short', qty: 2, multiplier: 100,
    })).toBe(-400);

    const scenarios = buildValuationScenario({
      prices: [90, 100, 110],
      optionType: 'call',
      strike: 100,
      premium: 5,
      time: 30 / 365.25,
      volatility: 0.25,
    });
    expect(scenarios).toHaveLength(3);
    expect(scenarios[2].todayPnL).toBeGreaterThan(scenarios[0].todayPnL);
    expect(scenarios[2].expiryPnL).toBe(500);
  });

  it('builds a time-decay series that converges to expiry value', () => {
    const series = buildTimeDecaySeries({
      days: [30, 7, 0],
      spot: 100,
      optionType: 'call',
      strike: 100,
      premium: 5,
      volatility: 0.25,
    });
    expect(series).toHaveLength(3);
    expect(series[0].theoreticalPrice).toBeGreaterThan(series[2].theoreticalPrice);
    expect(series[2].theoreticalPrice).toBe(0);
    expect(series[2].pnl).toBe(-500);
  });
});

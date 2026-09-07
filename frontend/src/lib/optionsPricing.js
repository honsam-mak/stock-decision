const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const validPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export function normPDF(value) {
  return Math.exp(-0.5 * value * value) / SQRT_TWO_PI;
}

export function normCDF(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (
    ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736)
    * t + 0.254829592
  ) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function yearsToExpiry(expiry, now = new Date()) {
  const expiryDate = expiry instanceof Date
    ? expiry
    : new Date(`${String(expiry || '')}T23:59:59`);
  if (Number.isNaN(expiryDate.getTime())) return 0;
  return Math.max(0, (expiryDate.getTime() - now.getTime()) / MS_PER_YEAR);
}

function pricingInputs(config) {
  const spot = Number(config.spot);
  const strike = Number(config.strike);
  const time = Number(config.time);
  const rate = Number(config.rate ?? 0.045);
  const dividendYield = Number(config.dividendYield ?? 0);
  const volatility = Number(config.volatility);
  const optionType = String(config.optionType || '').toLowerCase();
  if (
    !validPositive(spot)
    || !validPositive(strike)
    || !Number.isFinite(time)
    || !Number.isFinite(rate)
    || !Number.isFinite(dividendYield)
    || (time > 0 && !validPositive(volatility))
    || !['call', 'put'].includes(optionType)
  ) return null;
  return { spot, strike, time, rate, dividendYield, volatility, optionType };
}

export function blackScholesPrice(config) {
  const input = pricingInputs(config);
  if (!input) return null;
  const { spot, strike, time, rate, dividendYield, volatility, optionType } = input;
  if (time <= 0) {
    return optionType === 'call'
      ? Math.max(0, spot - strike)
      : Math.max(0, strike - spot);
  }

  const sqrtTime = Math.sqrt(time);
  const d1 = (
    Math.log(spot / strike)
    + (rate - dividendYield + volatility * volatility / 2) * time
  ) / (volatility * sqrtTime);
  const d2 = d1 - volatility * sqrtTime;
  const discountedSpot = spot * Math.exp(-dividendYield * time);
  const discountedStrike = strike * Math.exp(-rate * time);

  return optionType === 'call'
    ? discountedSpot * normCDF(d1) - discountedStrike * normCDF(d2)
    : discountedStrike * normCDF(-d2) - discountedSpot * normCDF(-d1);
}

export function calculateGreeks(config) {
  const input = pricingInputs(config);
  if (!input || input.time <= 0) return null;
  const { spot, strike, time, rate, dividendYield, volatility, optionType } = input;
  const sqrtTime = Math.sqrt(time);
  const d1 = (
    Math.log(spot / strike)
    + (rate - dividendYield + volatility * volatility / 2) * time
  ) / (volatility * sqrtTime);
  const d2 = d1 - volatility * sqrtTime;
  const spotDiscount = Math.exp(-dividendYield * time);
  const strikeDiscount = Math.exp(-rate * time);
  const commonTheta = -(spot * spotDiscount * normPDF(d1) * volatility) / (2 * sqrtTime);

  const delta = optionType === 'call'
    ? spotDiscount * normCDF(d1)
    : spotDiscount * (normCDF(d1) - 1);
  const gamma = spotDiscount * normPDF(d1) / (spot * volatility * sqrtTime);
  const vega = spot * spotDiscount * normPDF(d1) * sqrtTime / 100;
  const thetaAnnual = optionType === 'call'
    ? commonTheta
      - rate * strike * strikeDiscount * normCDF(d2)
      + dividendYield * spot * spotDiscount * normCDF(d1)
    : commonTheta
      + rate * strike * strikeDiscount * normCDF(-d2)
      - dividendYield * spot * spotDiscount * normCDF(-d1);
  const rho = optionType === 'call'
    ? strike * time * strikeDiscount * normCDF(d2) / 100
    : -strike * time * strikeDiscount * normCDF(-d2) / 100;

  return { delta, gamma, theta: thetaAnnual / 365, vega, rho };
}

export function impliedVolatility(marketPrice, config, tolerance = 1e-5) {
  const target = Number(marketPrice);
  if (!validPositive(target)) return null;
  let low = 0.0001;
  let high = 5;
  const lowPrice = blackScholesPrice({ ...config, volatility: low });
  const highPrice = blackScholesPrice({ ...config, volatility: high });
  if (lowPrice === null || highPrice === null || target < lowPrice - tolerance || target > highPrice + tolerance) {
    return null;
  }

  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    const price = blackScholesPrice({ ...config, volatility: mid });
    if (price === null) return null;
    if (Math.abs(price - target) <= tolerance) return mid;
    if (price > target) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export function optionTimeValue(marketPrice, intrinsic) {
  if (marketPrice === null || marketPrice === undefined || marketPrice === '') return null;
  if (intrinsic === null || intrinsic === undefined || intrinsic === '') return null;
  const market = Number(marketPrice);
  const intrinsicValue = Number(intrinsic);
  if (!Number.isFinite(market) || !Number.isFinite(intrinsicValue)) return null;
  return Math.max(0, market - intrinsicValue);
}

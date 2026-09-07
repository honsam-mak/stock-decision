const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizedDirection = (value) => (
  String(value || '').toLowerCase() === 'short' ? 'short' : 'long'
);

export function calcBreakeven({ optionType, strike, premium }) {
  const strikeValue = finiteNumber(strike);
  const premiumValue = finiteNumber(premium);
  if (strikeValue === null || premiumValue === null) return null;
  if (optionType === 'call') return strikeValue + premiumValue;
  if (optionType === 'put') return strikeValue - premiumValue;
  return null;
}

export function intrinsicValue({ optionType, strike, underlyingPrice }) {
  const strikeValue = finiteNumber(strike);
  const spot = finiteNumber(underlyingPrice);
  if (strikeValue === null || spot === null) return null;
  if (optionType === 'call') return Math.max(0, spot - strikeValue);
  if (optionType === 'put') return Math.max(0, strikeValue - spot);
  return null;
}

export function classifyMoneyness({ optionType, strike, underlyingPrice, tolerancePct = 0.005 }) {
  const strikeValue = finiteNumber(strike);
  const spot = finiteNumber(underlyingPrice);
  if (strikeValue === null || spot === null || !['call', 'put'].includes(optionType)) return null;

  const tolerance = Math.max(Math.abs(strikeValue) * tolerancePct, 0.01);
  if (Math.abs(spot - strikeValue) <= tolerance) return 'ATM';
  if (optionType === 'call') return spot > strikeValue ? 'ITM' : 'OTM';
  return spot < strikeValue ? 'ITM' : 'OTM';
}

export function calcExpiryPnL({
  optionType,
  strike,
  premium,
  underlyingPrice,
  direction = 'long',
  qty = 1,
  multiplier = 100,
}) {
  const intrinsic = intrinsicValue({ optionType, strike, underlyingPrice });
  const premiumValue = finiteNumber(premium);
  const quantity = finiteNumber(qty);
  const contractMultiplier = finiteNumber(multiplier);
  if (
    intrinsic === null
    || premiumValue === null
    || quantity === null
    || contractMultiplier === null
  ) return null;

  const longPnl = (intrinsic - premiumValue) * quantity * contractMultiplier;
  return normalizedDirection(direction) === 'short' ? -longPnl : longPnl;
}

export function buildScenarioPnL(config, prices) {
  return prices.map((underlyingPrice) => ({
    underlyingPrice: Number(underlyingPrice),
    pnl: calcExpiryPnL({ ...config, underlyingPrice }),
  }));
}

export function getExerciseImpact({
  optionType,
  direction = 'long',
  strike,
  qty = 1,
  multiplier = 100,
}) {
  const strikeValue = finiteNumber(strike);
  const quantity = finiteNumber(qty);
  const contractMultiplier = finiteNumber(multiplier);
  if (
    !['call', 'put'].includes(optionType)
    || strikeValue === null
    || quantity === null
    || contractMultiplier === null
  ) return null;

  const isLong = normalizedDirection(direction) === 'long';
  const action = optionType === 'call'
    ? (isLong ? 'Buy' : 'Sell')
    : (isLong ? 'Sell' : 'Buy');
  const shares = quantity * contractMultiplier;

  return {
    action,
    shares,
    cashFlow: (action === 'Buy' ? -1 : 1) * shares * strikeValue,
  };
}

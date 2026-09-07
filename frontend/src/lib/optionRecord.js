const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

export function normalizeOptionType(value) {
  const normalized = text(value).toLowerCase();
  return normalized === 'call' || normalized === 'put' ? normalized : null;
}

export function normalizeExpiry(value) {
  const normalized = text(value);
  if (!normalized) return null;

  const isoMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!isoMatch) return null;

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseExpiryFromAssetName(assetName) {
  const name = text(assetName);
  const namedMatch = name.match(/(?:^|\s)(\d{1,2})\s+([A-Za-z]{3})(\d{2,4})(?:\s|$)/i);
  if (namedMatch) {
    const day = Number(namedMatch[1]);
    const month = MONTHS[namedMatch[2].toLowerCase()];
    let year = Number(namedMatch[3]);
    if (year < 100) year += 2000;
    if (month !== undefined) {
      return normalizeExpiry(`${year}-${month + 1}-${day}`);
    }
  }

  const numericMatch = name.match(/(?:^|\s)(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s|$)/);
  return numericMatch
    ? normalizeExpiry(`${numericMatch[1]}-${numericMatch[2]}-${numericMatch[3]}`)
    : null;
}

export function parseOptionDetails(assetName) {
  const name = text(assetName);
  const typeMatch = name.match(/\b(Call|Put)\b/i);
  const strikeMatch = name.match(/\$?(\d+(?:\.\d+)?)\s*(?=Call|Put\b)/i);
  const strike = strikeMatch ? Number(strikeMatch[1]) : null;

  return {
    optionType: normalizeOptionType(typeMatch?.[1]),
    strike: Number.isFinite(strike) ? strike : null,
  };
}

export function isOptionTrade(trade) {
  const assetName = text(trade?.assetName);
  return text(trade?.assetClass).toLowerCase() === 'option'
    || normalizeOptionType(trade?.optionType) !== null
    || /\b(Call|Put)\b/i.test(assetName)
    || Number(trade?.multiplier || 1) > 1;
}

export function resolveOptionMeta(record = {}) {
  const parsed = parseOptionDetails(record.assetName);
  const explicitStrike = Number(record.strike);
  const strike = Number.isFinite(explicitStrike) && explicitStrike > 0
    ? explicitStrike
    : parsed.strike;

  return {
    underlying: (text(record.underlying) || text(record.symbol)).toUpperCase() || null,
    optionType: normalizeOptionType(record.optionType) || parsed.optionType,
    strike,
    expiry: normalizeExpiry(record.expiry) || parseExpiryFromAssetName(record.assetName),
  };
}

export function enrichOptionRecord(record = {}) {
  const item = { ...record };
  if (!isOptionTrade(item)) return item;

  const meta = resolveOptionMeta(item);
  item.assetClass = 'Option';
  if (meta.underlying) item.underlying = meta.underlying;
  if (meta.optionType) item.optionType = meta.optionType;
  if (meta.strike !== null) item.strike = meta.strike;
  if (meta.expiry) item.expiry = meta.expiry;
  return item;
}

export function optionExpiryDate(record) {
  const expiry = resolveOptionMeta(record).expiry;
  if (!expiry) return new Date(2099, 11, 31);
  const [year, month, day] = expiry.split('-').map(Number);
  return new Date(year, month - 1, day);
}

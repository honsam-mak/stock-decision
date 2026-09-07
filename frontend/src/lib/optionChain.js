import { resolveOptionMeta } from './optionRecord.js';

export function optionContractKey(value = {}) {
  const meta = resolveOptionMeta(value || {});
  if (!meta.underlying || !meta.optionType || !meta.expiry || meta.strike === null) return null;
  return [
    meta.underlying,
    meta.expiry,
    Number(meta.strike).toFixed(4),
    meta.optionType,
  ].join(':');
}

export function matchOptionContract(chain, record) {
  if (!record) return null;
  const meta = resolveOptionMeta(record);
  if (!chain || !meta.optionType || meta.strike === null || !meta.expiry) return null;
  const contracts = meta.optionType === 'call' ? chain.calls : chain.puts;
  return (contracts || []).find((contract) => (
    contract.optionType === meta.optionType
    && contract.expiry === meta.expiry
    && Math.abs(Number(contract.strike) - Number(meta.strike)) < 0.0001
  )) || null;
}

export function positionKeys(records = []) {
  const keys = new Set(records.map(optionContractKey).filter(Boolean));
  return new Set([...keys].filter((key) => aggregateOptionPosition(records, key)));
}

export function aggregateOptionPosition(records = [], contractOrKey) {
  const key = typeof contractOrKey === 'string'
    ? contractOrKey
    : optionContractKey(contractOrKey);
  if (!key) return null;
  const matching = records.filter((record) => optionContractKey(record) === key);
  if (matching.length === 0) return null;

  const signedQuantity = (record) => {
    const quantity = Number(record.openQty || record.qty || 0);
    return String(record.action || '').toUpperCase() === 'SELL' ? -quantity : quantity;
  };
  const netQuantity = matching.reduce((sum, record) => sum + signedQuantity(record), 0);
  if (Math.abs(netQuantity) < 1e-9) return null;
  const signedPremium = matching.reduce(
    (sum, record) => sum + Number(record.price || 0) * signedQuantity(record),
    0,
  );

  return {
    ...matching[0],
    action: netQuantity > 0 ? 'Buy' : 'Sell',
    qty: Math.abs(netQuantity),
    openQty: Math.abs(netQuantity),
    price: signedPremium / netQuantity,
  };
}

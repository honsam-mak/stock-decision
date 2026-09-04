const SUPPORTED_VERSIONS = new Set([undefined, null, '', '1.0', '1.1']);
const COLLECTIONS = ['stocks', 'simulations', 'records', 'marketDataCache'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSymbol(value) {
  return normalizeText(value).toUpperCase();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function deterministicId(prefix, value) {
  const input = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function canonicalId(canonicalIds, collection, item, fallback) {
  const values = canonicalIds?.[collection];
  if (!isPlainObject(values)) return fallback;
  const ownId = normalizeText(item.id);
  const symbol = normalizeSymbol(item.symbol);
  return normalizeText(values[ownId] || values[symbol] || fallback);
}

function normalizeItem(collection, value, index, canonicalIds) {
  assertPlainObject(value, `${collection}[${index}]`);
  const item = { ...value };
  if ('symbol' in item) item.symbol = normalizeSymbol(item.symbol);

  if (collection === 'stocks' && !item.symbol) {
    throw new Error(`stocks[${index}].symbol is required`);
  }
  if (collection === 'records' && !item.symbol) {
    throw new Error(`records[${index}].symbol is required`);
  }

  const prefix = collection === 'marketDataCache' ? 'market' : collection.slice(0, -1);
  const naturalId = collection === 'stocks' || collection === 'marketDataCache'
    ? item.symbol
    : '';
  const fallback = normalizeText(item.id) || naturalId || deterministicId(prefix, item);
  item.id = canonicalId(canonicalIds, collection, item, fallback) || fallback;

  if (collection === 'records' && item.sourceTradeId != null) {
    item.sourceTradeId = normalizeText(item.sourceTradeId);
  }
  return item;
}

function validateCollection(root, name) {
  const value = root[name];
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((item, index) => normalizeItem(name, item, index, root.canonicalIds));
}

function settingsOperation(id, data, existing, preserveExisting) {
  if (data == null) return null;
  assertPlainObject(data, id);
  const clean = { ...data };
  if (id === 'api') delete clean.alphaVantageKey;
  if (preserveExisting && isPlainObject(existing)) {
    Object.keys(existing).forEach((key) => delete clean[key]);
  }
  if (Object.keys(clean).length === 0) return null;
  return { op: 'set', collection: 'settings', id, data: clean, merge: true };
}

function canonicalMap(items) {
  return items.reduce((result, item) => {
    const id = normalizeText(item.id);
    if (id) result[id] = id;
    const symbol = normalizeSymbol(item.symbol);
    if (symbol) result[symbol] = id || symbol;
    return result;
  }, {});
}

export function createBackup({
  stocks = [],
  simulations = [],
  records = [],
  userSettings = null,
  performanceSettings = null,
  marketDataCache = [],
  source = {},
} = {}) {
  const safeUserSettings = isPlainObject(userSettings) ? { ...userSettings } : userSettings;
  if (safeUserSettings) delete safeUserSettings.alphaVantageKey;
  const normalized = {
    stocks: validateCollection({ stocks }, 'stocks'),
    simulations: validateCollection({ simulations }, 'simulations'),
    records: validateCollection({ records }, 'records'),
    marketDataCache: validateCollection({ marketDataCache }, 'marketDataCache'),
  };

  return {
    version: '1.1',
    exportDate: new Date().toISOString(),
    stocks: normalized.stocks,
    simulations: normalized.simulations,
    records: normalized.records,
    userSettings: safeUserSettings,
    performanceSettings,
    source: {
      app: 'stock-decision',
      format: 'frontend-backup',
      ...source,
    },
    canonicalIds: {
      stocks: canonicalMap(normalized.stocks),
      simulations: canonicalMap(normalized.simulations),
      records: canonicalMap(normalized.records),
      marketDataCache: canonicalMap(normalized.marketDataCache),
    },
    marketDataCache: normalized.marketDataCache,
  };
}

export function parseBackup(root, {
  existingUserSettings = null,
  existingPerformanceSettings = null,
} = {}) {
  assertPlainObject(root, 'backup');
  if (!SUPPORTED_VERSIONS.has(root.version)) throw new Error(`Unsupported backup version: ${root.version}`);
  if (!COLLECTIONS.some((name) => root[name] != null)
      && root.userSettings == null
      && root.performanceSettings == null) {
    throw new Error('Backup contains no importable data');
  }
  if (root.canonicalIds != null) assertPlainObject(root.canonicalIds, 'canonicalIds');
  if (root.source != null) assertPlainObject(root.source, 'source');

  const data = Object.fromEntries(COLLECTIONS.map((name) => [name, validateCollection(root, name)]));
  const collectionNames = {
    stocks: 'stocks',
    simulations: 'simulations',
    records: 'records',
    marketDataCache: 'market_data_cache',
  };
  const operations = [];
  COLLECTIONS.forEach((name) => {
    data[name].forEach((item) => {
      operations.push({
        op: 'set',
        collection: collectionNames[name],
        id: item.id,
        data: item,
        merge: true,
      });
    });
  });

  const preserveExisting = root.version !== '1.1';
  const userOperation = settingsOperation('api', root.userSettings, existingUserSettings, preserveExisting);
  const performanceOperation = settingsOperation(
    'performance',
    root.performanceSettings,
    existingPerformanceSettings,
    preserveExisting,
  );
  if (userOperation) operations.push(userOperation);
  if (performanceOperation) operations.push(performanceOperation);

  return {
    operations,
    summary: {
      version: root.version || 'unversioned',
      stocks: data.stocks.length,
      simulations: data.simulations.length,
      records: data.records.length,
      marketDataCache: data.marketDataCache.length,
      settings: Number(Boolean(userOperation)) + Number(Boolean(performanceOperation)),
      total: operations.length,
    },
  };
}

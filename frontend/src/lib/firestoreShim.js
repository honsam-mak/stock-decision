/**
 * Drop-in replacement for the subset of the Firestore SDK the original app used,
 * backed by the local FastAPI + OpenSearch service.
 *
 * Keeping the same call signatures means every `doc(db, 'artifacts', appId,
 * 'users', uid, 'stocks', id)` call site in App.jsx works unchanged. Firestore
 * paths are collapsed to a flat collection name, since this is a single-user
 * local deployment.
 *
 * `onSnapshot` has no push channel here, so it polls and re-reads immediately
 * whenever this client performs a write.
 */

import { api } from './api.js';

const KNOWN_COLLECTIONS = ['stocks', 'simulations', 'records', 'settings', 'market_data_cache'];
const POLL_INTERVAL_MS = 2000;

// Notifies active listeners that local data changed, so the UI updates without
// waiting out the poll interval.
const listeners = new Set();

function notifyWrite(collection) {
  listeners.forEach((fn) => fn(collection));
}

function resolvePath(segments) {
  const flat = segments.flat().filter(Boolean).map(String);
  for (let i = flat.length - 1; i >= 0; i--) {
    if (KNOWN_COLLECTIONS.includes(flat[i])) {
      return { collection: flat[i], id: flat[i + 1] ?? null };
    }
  }
  throw new Error(`Unsupported document path: ${flat.join('/')}`);
}

export const db = { __local: true };

export function collection(_db, ...segments) {
  const { collection: name } = resolvePath(segments);
  return { type: 'collection', collection: name };
}

export function doc(dbOrCollectionRef, ...segments) {
  // doc(collectionRef) — generate a new document id, as the original code does
  // when creating stocks, simulations, and records.
  if (segments.length === 0 && dbOrCollectionRef?.type === 'collection') {
    return {
      type: 'doc',
      collection: dbOrCollectionRef.collection,
      id: crypto.randomUUID(),
    };
  }
  const { collection: name, id } = resolvePath(segments);
  return { type: 'doc', collection: name, id };
}

export async function setDoc(ref, data, options = {}) {
  await api.setDoc(ref.collection, ref.id, data, Boolean(options.merge));
  notifyWrite(ref.collection);
}

export async function deleteDoc(ref) {
  await api.deleteDoc(ref.collection, ref.id);
  notifyWrite(ref.collection);
}

export async function getDoc(ref) {
  const result = await api.getDoc(ref.collection, ref.id);
  return {
    id: ref.id,
    exists: () => result.exists,
    data: () => result.data || {},
  };
}

function makeCollectionSnapshot(docs) {
  const snapshot = {
    docs: docs.map((d) => ({ id: d.id, data: () => d })),
    empty: docs.length === 0,
    size: docs.length,
  };
  snapshot.forEach = (cb) => snapshot.docs.forEach(cb);
  return snapshot;
}

export function onSnapshot(ref, onNext, onError) {
  let cancelled = false;
  let lastSerialized = null;

  const read = async () => {
    if (cancelled) return;
    try {
      if (ref.type === 'collection') {
        const docs = await api.listDocs(ref.collection);
        const serialized = JSON.stringify(docs);
        if (serialized === lastSerialized) return;
        lastSerialized = serialized;
        onNext(makeCollectionSnapshot(docs));
      } else {
        const result = await api.getDoc(ref.collection, ref.id);
        const serialized = JSON.stringify(result);
        if (serialized === lastSerialized) return;
        lastSerialized = serialized;
        onNext({
          id: ref.id,
          exists: () => result.exists,
          data: () => result.data || {},
        });
      }
    } catch (err) {
      if (onError) onError(err);
    }
  };

  read();
  const timer = setInterval(read, POLL_INTERVAL_MS);
  const onWrite = (collectionName) => {
    if (collectionName === ref.collection) read();
  };
  listeners.add(onWrite);

  return () => {
    cancelled = true;
    clearInterval(timer);
    listeners.delete(onWrite);
  };
}

export function writeBatch() {
  const operations = [];
  return {
    set(ref, data, options = {}) {
      operations.push({
        op: 'set',
        collection: ref.collection,
        id: ref.id,
        data,
        merge: Boolean(options.merge),
      });
    },
    update(ref, data) {
      operations.push({
        op: 'set',
        collection: ref.collection,
        id: ref.id,
        data,
        merge: true,
      });
    },
    delete(ref) {
      operations.push({ op: 'delete', collection: ref.collection, id: ref.id });
    },
    async commit() {
      if (operations.length === 0) return;
      await api.batch(operations);
      new Set(operations.map((o) => o.collection)).forEach(notifyWrite);
    },
  };
}

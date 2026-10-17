import KVRange, { idbRange } from './KVRange.js';
const idb = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
const idbTrans = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || { READ_WRITE: 'readwrite' };
const identity = x => x;

export function asPromise(request, handlers = {}) {
  return new Promise((resolve, reject) => {
    if (typeof request === 'function') {
      try {
        request = request();
      } catch (err) {
        reject(err);
      }
    }
    request.onerror = () => reject(request.error || request.errorCode);
    request.onabort = () => reject(request.error || request.errorCode);
    request.onsuccess = request.oncomplete = () => resolve(request.result);
    for (const key of Object.keys(handlers)) {
      request[key] = handlers[key];
    }
  });
};

function compareBounded(l, lo, lu, r, ro, ru) {
  if (l === undefined && r === undefined) {
    return 0;
  } else if (l === undefined) {
    return lu ? 1 : -1;
  } else if (r === undefined) {
    return ru ? -1 : 1;
  } else if (l === r) {
    if (lo && !ro) {
      return 1;
    } else if (!lo && ro) {
      return -1;
    } else if (!lu && ru) {
      return 1;
    } else if (lu && !ru) {
      return -1;
    }
    return 0;
  }
  return l < r ? -1 : 1;
}

const compareRanges = (l, r) => (
  compareBounded(l.lower, l.lowerOpen, false, r.lower, r.lowerOpen, false) ||
  compareBounded(l.upper, l.upperOpen, true, r.upper, r.upperOpen, true)
);

window.KVRange = KVRange;

class KVIndex {
  constructor(index, store) {
    this._store = index;
    this.store = store;
  }

  get name() {
    return this._store.name;
  }

  count(key) {
    return asPromise(() => this._store.count(key));
  }

  getKeys(range) {
    return asPromise(() => this._store.getAllKeys(range));
  }

  get(keyOrRange) {
    if (keyOrRange === undefined) {
      return asPromise(() => this._store.getAll());
    } else if (keyOrRange instanceof KVRange) {
      const ranges = keyOrRange._idbRanges;
      return Promise.all(ranges.map(range => asPromise(() => this._store.getAll(range))))
        .then(results => [].concat(...results));
    } else {
      return asPromise(() => this._store.get(keyOrRange));
    }
  }
};

class KVStore extends KVIndex {
  constructor(store) {
    super(store, store);
  }

  get indexNames() {
    return this._store.indexNames;
  }

  get keyPath() {
    return this._store.keyPath;
  }

  get autoIncrement() {
    return this._store.autoIncrement;
  }

  clear() {
    return asPromise(() => this._store.clear());
  }

  put(keyOrValue, value) {
    if (value) {
      return asPromise(() => this._store.put(value, keyOrValue));
    } else {
      return asPromise(() => this._store.put(keyOrValue));
    }
  }

  delete(key) {
    return asPromise(() => this._store.delete(key instanceof idbRange ? key._range : key));
  }

  index(name) {
    return new KVIndex(this._store.index(name));
  }
};

class KVStoreSchema extends KVStore {
  constructor(store) {
    super(store);
  }

  set name(value) {
    this._store.name = value;
  }

  createIndex(name, path, options = { unique: false }) {
    this._store.createIndex(name, path, options);
  }

  deleteIndex(name) {
    this._store.deleteIndex(name);
  }
};

class KVTransaction {
  constructor(parent, mode, stores) {
    this.parent = parent;
    if (!Array.isArray(stores)) {
      stores = [stores];
    }
    if (typeof mode === 'string') {
      this._txn = parent.db.transaction(stores, mode);
    } else {
      this._txn = mode;
    }
    for (const store of stores) {
      this[store] = new KVStore(this._txn.objectStore(store));
    }
    this._promise = asPromise(this._txn);
  }

  abort() {
    this._txn.abort();
  }
};

class KVSchemaTransaction extends KVTransaction {
  constructor(parent, txn) {
    super(parent, txn, [...parent.db.objectStoreNames]);
  }

  createStore(name, keyPath, autoIncrement = false) {
    return this[name] = new KVStoreSchema(this.parent.db.createObjectStore(name, { keyPath, autoIncrement }));
  }

  deleteStore(name) {
    this.parent.deleteObjectStore(name);
    this[name] = undefined;
  }
};

export default class KVDatabase {
  static get isSupported() {
    return !!idb;
  }

  static deleteDatabase(dbName) {
    return asPromise(() => idb.deleteDatabase(dbName));
  }

  constructor(dbName, migrations = []) {
    if (!KVDatabase.isSupported) {
      this.db = false;
      return;
    }

    this._dbMigrations = migrations;
    this.version = -1;

    const upgradeHandlers = {
      onupgradeneeded: this._onUpgradeNeeded.bind(this),
      onblocked: this._onBlocked.bind(this),
    };
    this._readyPromise = asPromise(() => idb.open(dbName, migrations.length), upgradeHandlers)
      .then(result => {
        this.db = result;
        this.version = result.version;
      })
      .catch(errorCode => {
        console.error(errorCode);
        this.db = false;
      });
  }

  get ready() {
    return !!this.db;
  }

  get failed() {
    return this.db === false;
  }

  _onUpgradeNeeded(event) {
    this.db = event.target.result;
    const { oldVersion, newVersion } = event;
    const txn = new KVSchemaTransaction(this, event.target.transaction);
    for (let i = oldVersion; i < newVersion; i++) {
      console.log('running migration', (i+1));
      this._dbMigrations[i](txn);
    }
  }

  _onBlocked(event) {
    console.log('onBlocked', event);
    this.db = false;
  }

  _transaction(stores, mode, worker) {
    return this._readyPromise.then(() => {
      const storeArray = Array.isArray(stores) ? stores : [stores];
      const txn = new KVTransaction(this, mode, stores);
      const result = worker(txn);
      return txn._promise.then(() => result);
    });
  }

  readTransaction(stores, worker) {
    return this._transaction(stores, 'readonly', worker);
  }

  writeTransaction(stores, worker) {
    return this._transaction(stores, 'readwrite', worker);
  }
};

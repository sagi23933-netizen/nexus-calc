/**
 * better-sqlite3 compatible facade over the Durable Object SQLite API (ctx.storage.sql),
 * so server/db.js and every service run unchanged on Cloudflare.
 * The Durable Object calls attachStorage() in its constructor; statements issued before that
 * (the schema in db.js) are queued and replayed.
 */
let storage = null;
const pending = [];
let txDepth = 0;

export function attachStorage(s) {
  storage = s;
  while (pending.length) storage.sql.exec(pending.shift());
}

function sql() {
  if (!storage) throw new Error('Database is not attached yet');
  return storage.sql;
}

const norm = (params) => params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p));

class Statement {
  constructor(text) {
    this.text = text;
  }
  get(...params) {
    return sql().exec(this.text, ...norm(params)).toArray()[0];
  }
  all(...params) {
    return sql().exec(this.text, ...norm(params)).toArray();
  }
  run(...params) {
    const cursor = sql().exec(this.text, ...norm(params));
    cursor.toArray();
    const isInsert = /^\s*(insert|replace)/i.test(this.text);
    const lastInsertRowid = isInsert ? sql().exec('SELECT last_insert_rowid() AS id').one().id : 0;
    return { changes: cursor.rowsWritten, lastInsertRowid };
  }
}

export default class Database {
  pragma() {
    /* journal mode / foreign keys are managed by Cloudflare */
  }
  exec(text) {
    if (!storage) pending.push(text);
    else sql().exec(text);
    return this;
  }
  prepare(text) {
    return new Statement(text);
  }
  transaction(fn) {
    return (...args) => {
      if (txDepth > 0) return fn(...args); // nested: the outer transaction covers it
      txDepth++;
      try {
        return storage.transactionSync(() => fn(...args));
      } finally {
        txDepth--;
      }
    };
  }
}

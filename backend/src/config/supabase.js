'use strict';
// Couche de compatibilité Supabase → pg
// Remplace @supabase/supabase-js pour toutes les opérations base de données
// API identique : supabase.from(table).select().eq().single() etc.
const { Pool } = require('pg');

const isLocal = (process.env.DATABASE_URL || '').includes('localhost') ||
                (process.env.DATABASE_URL || '').includes('127.0.0.1') ||
                (process.env.DATABASE_URL || '').includes('kasolife-postgres');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

// Quote un nom de colonne (gère table.colonne et mots réservés)
function qcol(col) {
  col = (col || '').trim();
  if (col === '*' || col.startsWith('$')) return col;
  if (col.includes('.')) {
    const dot = col.indexOf('.');
    return `${col.slice(0, dot)}."${col.slice(dot + 1)}"`;
  }
  return `"${col}"`;
}

// Analyse les colonnes SELECT et supprime les relations imbriquées
// "id, name, profile:creator_profiles(id, bio)" → ["id", "name"]
function parseSelectCols(cols) {
  if (!cols || cols === '*') return '*';
  const result = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i <= cols.length; i++) {
    const ch = i < cols.length ? cols[i] : ',';
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) {
      const col = current.trim();
      // Inclure uniquement les colonnes simples (sans parenthèses = sans relations imbriquées)
      if (col && !col.includes('(')) {
        // Ignorer les alias de relation : "alias:table" (contient : sans espace)
        if (!col.includes(':') || col.includes(' ')) {
          result.push(col.trim());
        }
      }
      current = '';
    } else if (depth === 0) {
      current += ch;
    }
  }

  if (result.length === 0) return '*';
  return result.map(qcol).join(', ');
}

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._op = 'select';
    this._selectCols = null;
    this._mutationData = null;
    this._conditions = [];
    this._orStr = null;
    this._orderClauses = [];
    this._limitVal = null;
    this._offsetVal = null;
    this._isSingle = false;
    this._isMaybeSingle = false;
    this._upsertConflict = null;
  }

  // ── Opérations principales ────────────────────────────────────────────
  select(cols = '*') {
    this._selectCols = parseSelectCols(cols);
    return this;
  }

  insert(data) {
    this._op = 'insert';
    this._mutationData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this._op = 'update';
    this._mutationData = data;
    return this;
  }

  delete() {
    this._op = 'delete';
    return this;
  }

  upsert(data, opts = {}) {
    this._op = 'upsert';
    this._mutationData = Array.isArray(data) ? data : [data];
    this._upsertConflict = opts.onConflict || 'id';
    return this;
  }

  // ── Filtres ────────────────────────────────────────────────────────────
  eq(col, val) {
    this._conditions.push(val === null
      ? { col, op: 'IS NULL', val: null }
      : { col, op: '=', val });
    return this;
  }

  neq(col, val) {
    this._conditions.push(val === null
      ? { col, op: 'IS NOT NULL', val: null }
      : { col, op: '!=', val });
    return this;
  }

  gt(col, val)  { this._conditions.push({ col, op: '>', val }); return this; }
  gte(col, val) { this._conditions.push({ col, op: '>=', val }); return this; }
  lt(col, val)  { this._conditions.push({ col, op: '<', val }); return this; }
  lte(col, val) { this._conditions.push({ col, op: '<=', val }); return this; }
  like(col, val)  { this._conditions.push({ col, op: 'LIKE', val }); return this; }
  ilike(col, val) { this._conditions.push({ col, op: 'ILIKE', val }); return this; }

  is(col, val) {
    if (val === null)  this._conditions.push({ col, op: 'IS NULL',  val: null });
    else if (val === true)  this._conditions.push({ col, op: 'IS TRUE',  val: null });
    else if (val === false) this._conditions.push({ col, op: 'IS FALSE', val: null });
    else this._conditions.push({ col, op: '=', val });
    return this;
  }

  in(col, vals) {
    this._conditions.push({ col, op: 'IN', val: Array.isArray(vals) ? vals : [vals] });
    return this;
  }

  not(col, op, val) {
    const map = { eq: '!=', in: 'NOT IN', is: 'IS NOT', like: 'NOT LIKE', ilike: 'NOT ILIKE' };
    if (op === 'is' && val === null) {
      this._conditions.push({ col, op: 'IS NOT NULL', val: null });
    } else {
      this._conditions.push({ col, op: map[op] || `NOT ${op}`, val });
    }
    return this;
  }

  match(obj) {
    for (const [c, v] of Object.entries(obj)) this.eq(c, v);
    return this;
  }

  filter(col, op, val) {
    const map = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
                  like: 'LIKE', ilike: 'ILIKE', is: 'IS', in: 'IN', cs: '@>', cd: '<@' };
    this._conditions.push({ col, op: map[op] || op, val });
    return this;
  }

  or(filterStr) { this._orStr = filterStr; return this; }

  contains(col, val) {
    this._conditions.push({ col, op: '@>', val });
    return this;
  }

  // ── Modificateurs ──────────────────────────────────────────────────────
  order(col, { ascending = true } = {}) {
    this._orderClauses.push(`${qcol(col)} ${ascending ? 'ASC' : 'DESC'}`);
    return this;
  }

  limit(n)  { this._limitVal = parseInt(n, 10); return this; }

  range(from, to) {
    this._offsetVal = parseInt(from, 10);
    this._limitVal  = parseInt(to, 10) - parseInt(from, 10) + 1;
    return this;
  }

  single()      { this._isSingle = true; return this; }
  maybeSingle() { this._isMaybeSingle = true; return this; }

  // ── Construction WHERE ─────────────────────────────────────────────────
  _buildWhere(params, startIdx) {
    const parts = [];
    let idx = startIdx;

    for (const { col, op, val } of this._conditions) {
      const c = qcol(col);
      if (op === 'IS NULL' || op === 'IS NOT NULL' || op === 'IS TRUE' || op === 'IS FALSE') {
        parts.push(`${c} ${op}`);
      } else if (op === 'IN' || op === 'NOT IN') {
        const arr = Array.isArray(val) ? val : [val];
        if (arr.length === 0) { parts.push('FALSE'); }
        else {
          const ph = arr.map(() => `$${idx++}`).join(', ');
          params.push(...arr);
          parts.push(`${c} ${op} (${ph})`);
        }
      } else if (op === '@>' || op === '<@') {
        params.push(typeof val === 'string' ? val : JSON.stringify(val));
        parts.push(`${c} ${op} $${idx++}::jsonb`);
      } else {
        params.push(val);
        parts.push(`${c} ${op} $${idx++}`);
      }
    }

    // Conditions OR : "col.eq.val,col2.gt.val2"
    if (this._orStr) {
      const opMap = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
                      like: 'LIKE', ilike: 'ILIKE' };
      const orParts = this._orStr.split(',').map(s => {
        const firstDot  = s.indexOf('.');
        const secondDot = s.indexOf('.', firstDot + 1);
        const col2 = s.slice(0, firstDot).trim();
        const op2  = s.slice(firstDot + 1, secondDot).trim();
        const val2 = s.slice(secondDot + 1).trim();
        params.push(val2);
        return `${qcol(col2)} ${opMap[op2] || op2} $${idx++}`;
      });
      if (orParts.length > 0) parts.push(`(${orParts.join(' OR ')})`);
    }

    return parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '';
  }

  // ── Format résultat ────────────────────────────────────────────────────
  _formatResult(rows) {
    if (this._isSingle) {
      if (rows.length === 0) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
      return { data: rows[0], error: null };
    }
    if (this._isMaybeSingle) return { data: rows.length > 0 ? rows[0] : null, error: null };
    return { data: rows, error: null };
  }

  // ── Exécution (déclenchée par await) ──────────────────────────────────
  then(resolve, reject) { this._execute().then(resolve, reject); }

  async _execute() {
    try {
      const cols = this._selectCols || '*';

      // ── SELECT ────────────────────────────────────────────────────────
      if (this._op === 'select') {
        const params = [];
        const where  = this._buildWhere(params, 1);
        let sql = `SELECT ${cols} FROM ${this._table} ${where}`;
        if (this._orderClauses.length) sql += ` ORDER BY ${this._orderClauses.join(', ')}`;
        if (this._limitVal  !== null)  sql += ` LIMIT ${this._limitVal}`;
        if (this._offsetVal !== null)  sql += ` OFFSET ${this._offsetVal}`;
        const res = await pool.query(sql, params);
        return this._formatResult(res.rows);
      }

      // ── INSERT ────────────────────────────────────────────────────────
      if (this._op === 'insert') {
        const allRows = [];
        for (const row of this._mutationData) {
          const keys = Object.keys(row);
          const vals = Object.values(row);
          const ph   = vals.map((_, i) => `$${i + 1}`).join(', ');
          const qk   = keys.map(k => `"${k}"`).join(', ');
          const sql  = `INSERT INTO ${this._table} (${qk}) VALUES (${ph}) RETURNING ${cols}`;
          const res  = await pool.query(sql, vals);
          allRows.push(...res.rows);
        }
        return this._formatResult(allRows);
      }

      // ── UPSERT ────────────────────────────────────────────────────────
      if (this._op === 'upsert') {
        const allRows       = [];
        const conflictCols  = (this._upsertConflict || 'id').split(',').map(c => `"${c.trim()}"`).join(', ');
        const conflictKeys  = (this._upsertConflict || 'id').split(',').map(c => c.trim());
        for (const row of this._mutationData) {
          const keys    = Object.keys(row);
          const vals    = Object.values(row);
          const ph      = vals.map((_, i) => `$${i + 1}`).join(', ');
          const qk      = keys.map(k => `"${k}"`).join(', ');
          const upd     = keys.filter(k => !conflictKeys.includes(k))
                              .map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
          const doClause = upd ? `DO UPDATE SET ${upd}` : 'DO NOTHING';
          const sql = `INSERT INTO ${this._table} (${qk}) VALUES (${ph}) ON CONFLICT (${conflictCols}) ${doClause} RETURNING ${cols}`;
          const res = await pool.query(sql, vals);
          allRows.push(...res.rows);
        }
        return this._formatResult(allRows);
      }

      // ── UPDATE ────────────────────────────────────────────────────────
      if (this._op === 'update') {
        const data    = this._mutationData;
        const keys    = Object.keys(data);
        const vals    = Object.values(data);
        const setStr  = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const condParams = [];
        const where   = this._buildWhere(condParams, vals.length + 1);
        const ret     = this._selectCols ? `RETURNING ${cols}` : '';
        const sql     = `UPDATE ${this._table} SET ${setStr} ${where} ${ret}`;
        const res     = await pool.query(sql, [...vals, ...condParams]);
        return this._formatResult(res.rows);
      }

      // ── DELETE ────────────────────────────────────────────────────────
      if (this._op === 'delete') {
        const params = [];
        const where  = this._buildWhere(params, 1);
        const ret    = this._selectCols ? `RETURNING ${cols}` : '';
        const sql    = `DELETE FROM ${this._table} ${where} ${ret}`;
        const res    = await pool.query(sql, params);
        return this._formatResult(res.rows);
      }

      return { data: null, error: { message: `Opération inconnue: ${this._op}` } };
    } catch (err) {
      console.error(`[DB] ${this._op} ${this._table}:`, err.message);
      return {
        data: null,
        error: { code: err.code, message: err.message, details: err.detail || null, hint: err.hint || null },
      };
    }
  }
}

const supabase = {
  from: (table) => new QueryBuilder(table),

  rpc: async (fnName, params = {}) => {
    try {
      const keys = Object.keys(params);
      const vals = Object.values(params);
      let sql;
      if (keys.length === 0) {
        sql = `SELECT * FROM ${fnName}()`;
      } else {
        const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
        sql = `SELECT * FROM ${fnName}(${args})`;
      }
      const res = await pool.query(sql, vals);
      if (res.rows.length === 0) return { data: null, error: null };
      if (res.rows.length === 1 && res.fields.length === 1) {
        return { data: res.rows[0][res.fields[0].name], error: null };
      }
      return { data: res.rows.length === 1 ? res.rows[0] : res.rows, error: null };
    } catch (err) {
      console.error(`[DB] RPC ${fnName}:`, err.message);
      return { data: null, error: { code: err.code, message: err.message } };
    }
  },

  // Stub storage — uploads.js utilise supabase-storage.js pour les opérations fichiers
  storage: {
    from: (bucket) => ({
      upload: async () => ({ data: null, error: { message: `Storage non disponible via supabase.js. Utiliser supabase-storage.js (bucket: ${bucket})` } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      remove: async () => ({ data: null, error: null }),
      download: async () => ({ data: null, error: { message: `Storage non disponible via supabase.js. Utiliser supabase-storage.js (bucket: ${bucket})` } }),
    }),
  },

  // Exposer le pool pg pour les transactions directes si nécessaire
  pool,
};

module.exports = supabase;

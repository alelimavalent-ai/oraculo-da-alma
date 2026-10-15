// ===========================================================
//  Banco de dados — sql.js (SQLite em WebAssembly).
//  100% JavaScript/WASM: SEM compilação nativa, SEM node-gyp,
//  SEM Visual Studio, SEM Python. Funciona em qualquer Node.
//
//  Persistência: o banco vive em memória e é salvo em arquivo
//  (DATABASE_URL) a cada gravação. Nada se perde ao reiniciar.
//
//  Esta camada imita a API do better-sqlite3
//  (db.prepare().get()/.all()/.run(), db.exec()) para que o
//  resto do projeto continue igual.
// ===========================================================
const fs = require('fs');
const path = require('path');
const config = require('./env');

const dbPath = config.databaseAbsolutePath;
let SQL = null;     // módulo sql.js inicializado
let sqlDb = null;   // instância do banco

// Garante a pasta do banco (ex.: ./data)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Grava o estado atual do banco em disco.
function save() {
  if (!sqlDb) return;
  const data = Buffer.from(sqlDb.export());
  fs.writeFileSync(dbPath, data);
}

// Converte os argumentos no formato de bind do sql.js.
// - 1 objeto  -> parâmetros nomeados (@nome)
// - demais    -> parâmetros posicionais (?)
function buildBind(args) {
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = {};
    for (const k of Object.keys(args[0])) {
      const v = args[0][k];
      obj['@' + k] = v === undefined ? null : v;
    }
    return obj;
  }
  return args.map((v) => (v === undefined ? null : v));
}

// Cria um "statement" compatível com better-sqlite3.
function prepare(sql) {
  return {
    get(...args) {
      const st = sqlDb.prepare(sql);
      try {
        st.bind(buildBind(args));
        return st.step() ? st.getAsObject() : undefined;
      } finally { st.free(); }
    },
    all(...args) {
      const st = sqlDb.prepare(sql);
      const rows = [];
      try {
        st.bind(buildBind(args));
        while (st.step()) rows.push(st.getAsObject());
      } finally { st.free(); }
      return rows;
    },
    run(...args) {
      const st = sqlDb.prepare(sql);
      try {
        st.bind(buildBind(args));
        st.step();
      } finally { st.free(); }
      const changes = sqlDb.getRowsModified();
      let lastInsertRowid = null;
      const r = sqlDb.exec('SELECT last_insert_rowid() AS id');
      if (r.length && r[0].values.length) lastInsertRowid = r[0].values[0][0];
      save();
      return { changes, lastInsertRowid };
    },
  };
}

// Executa SQL direto (DDL, múltiplas instruções).
function exec(sql) {
  sqlDb.run(sql);
  save();
}

// Mantido por compatibilidade (no-op útil para PRAGMAs).
function pragma(p) {
  try { sqlDb.run('PRAGMA ' + p); } catch { /* ignorado */ }
}

// ---------- Schema ----------
function createSchema() {
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name         TEXT    NOT NULL,
      birth_date        TEXT    NOT NULL,
      birth_time        TEXT,
      birth_city        TEXT,
      mother_name       TEXT,
      email             TEXT    NOT NULL UNIQUE,
      phone             TEXT,
      password_hash     TEXT    NOT NULL,
      role              TEXT    NOT NULL DEFAULT 'customer',
      status            TEXT    NOT NULL DEFAULT 'active',
      reset_token       TEXT,
      reset_expires_at  TEXT,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS consultations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      type        TEXT    NOT NULL,
      category    TEXT,
      status      TEXT    NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pendente',
      result_text TEXT,
      pdf_path    TEXT,
      input_json     TEXT,
      technical_json TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      consultation_id INTEGER,
      amount_cents    INTEGER NOT NULL DEFAULT 3990,
      method          TEXT    NOT NULL DEFAULT 'pix',
      status          TEXT    NOT NULL DEFAULT 'pending',
      provider_txid   TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      confirmed_at    TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// Migração leve para bancos já existentes (adiciona colunas que faltam).
function ensureColumn(table, column, definition) {
  const st = sqlDb.prepare(`PRAGMA table_info(${table})`);
  const cols = [];
  try { while (st.step()) cols.push(st.getAsObject().name); } finally { st.free(); }
  if (!cols.includes(column)) {
    sqlDb.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations() {
  ensureColumn('consultations', 'input_json', 'TEXT');
  ensureColumn('consultations', 'technical_json', 'TEXT');
  ensureColumn('consultations', 'payment_status', "TEXT NOT NULL DEFAULT 'pendente'");
  // Consulta grátis (1 por CPF) e liberação do PDF pago
  ensureColumn('consultations', 'is_free', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('consultations', 'pdf_paid', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'cpf', 'TEXT');
  sqlDb.run(`CREATE TABLE IF NOT EXISTS gratis_cpf (
    cpf TEXT PRIMARY KEY,
    user_id INTEGER,
    consultation_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  // Padroniza o papel antigo 'user' para 'customer'
  sqlDb.run("UPDATE users SET role = 'customer' WHERE role = 'user'");
  // Valor padrão da consulta (em centavos): R$ 39,99 — editável no admin
  // Se existir CONSULTA_PRECO_CENTAVOS no Render, ele vale a cada reinício (ex.: 1000 = R$ 10,00).
  const precoEnv = parseInt(process.env.CONSULTA_PRECO_CENTAVOS || '', 10);
  if (Number.isFinite(precoEnv) && precoEnv > 0) {
    sqlDb.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('consultation_price_cents', ?)", [String(precoEnv)]);
  } else {
    sqlDb.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('consultation_price_cents', '3999')");
  }
}

// ---------- Inicialização (assíncrona, uma única vez) ----------
async function init() {
  if (sqlDb) return module.exports;
  const initSqlJs = require('sql.js');
  const distDir = path.dirname(require.resolve('sql.js'));
  SQL = await initSqlJs({ locateFile: (f) => path.join(distDir, f) });

  if (fs.existsSync(dbPath)) {
    sqlDb = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run('PRAGMA foreign_keys = ON');
  createSchema();
  runMigrations();
  save();
  return module.exports;
}

module.exports = { prepare, exec, pragma, init, save };

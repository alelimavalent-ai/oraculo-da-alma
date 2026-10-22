// ============================================================
//  Super Admin — criação, atualização e verificação.
//  Roda na subida do servidor e também no endpoint de reset.
//  Verifica o bcrypt de volta e imprime o status no terminal.
// ============================================================
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const config = require('../config/env');

const SUPER_ROLE = 'superadmin';

/**
 * Garante que o Super Admin exista com a senha correta.
 * @param {boolean} forceReset  se true, apaga e recria do zero (limpa duplicados/corrompidos)
 */
function ensureMaster({ forceReset = false } = {}) {
  const { name, email, password } = config.superAdmin;
  if (!email || !password) {
    console.warn('[ADMIN] Credenciais do Super Admin ausentes na configuração.');
    return { ok: false };
  }

  const hash = bcrypt.hashSync(password, 10);
  let existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (forceReset && existing) {
    db.prepare('DELETE FROM users WHERE email = ?').run(email);
    existing = null;
  }

  if (existing) {
    db.prepare(`
      UPDATE users
      SET full_name = ?, password_hash = ?, role = ?, status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `).run(name, hash, SUPER_ROLE, existing.id);
  } else {
    db.prepare(`
      INSERT INTO users (full_name, birth_date, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(name, '2000-01-01', email, hash, SUPER_ROLE);
  }

  // Lê de volta e CONFIRMA que a senha bate (round-trip real do bcrypt).
  const saved = db.prepare('SELECT id, email, password_hash, role, status FROM users WHERE email = ?').get(email);
  const senhaOk = saved ? bcrypt.compareSync(password, saved.password_hash) : false;

  console.log('==============================================');
  console.log('SUPER ADMIN PRONTO');
  console.log('Email: ' + email);
  console.log('Senha: (definida no Render — ADMIN_PASSWORD)');
  console.log('Papel: ' + (saved ? saved.role : '—') + '  |  Login verificado: ' + (senhaOk ? 'OK' : 'FALHOU'));
  console.log('==============================================');

  return { ok: senhaOk, user: saved };
}

// Executado automaticamente na subida do servidor.
function seedAdmin() {
  try {
    ensureMaster({ forceReset: false });
  } catch (err) {
    console.error('[ADMIN] Falha ao preparar o Super Admin:', err.message);
  }
}

module.exports = { seedAdmin, ensureMaster, SUPER_ROLE };

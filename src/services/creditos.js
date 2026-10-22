// Pacote de consultas: o cliente paga 1 PIX e leva N consultas (padrão 2).
// A 1ª consulta é liberada no pagamento; as demais viram crédito na conta.
const db = require('../config/database');

function consultasPorPacote() {
  const n = parseInt(process.env.CONSULTAS_POR_PACOTE || '2', 10);
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

function creditosDoUsuario(userId) {
  const u = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
  return u ? (u.credits || 0) : 0;
}

// Usa 1 crédito (só se houver). Retorna true se conseguiu.
function usarCredito(userId) {
  const r = db.prepare('UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0').run(userId);
  return r.changes === 1;
}

function devolverCredito(userId) {
  db.prepare('UPDATE users SET credits = COALESCE(credits, 0) + 1 WHERE id = ?').run(userId);
}

// Confirma o pagamento UMA vez só e, nessa hora, entrega os créditos extras do pacote.
function confirmarPagamentoPacote(payment) {
  const r = db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ? AND status != 'confirmed'").run(payment.id);
  if (r.changes === 1 && payment.method === 'pix') {
    const extras = consultasPorPacote() - 1;
    if (extras > 0) db.prepare('UPDATE users SET credits = COALESCE(credits, 0) + ? WHERE id = ?').run(extras, payment.user_id);
  }
}

module.exports = { consultasPorPacote, creditosDoUsuario, usarCredito, devolverCredito, confirmarPagamentoPacote };

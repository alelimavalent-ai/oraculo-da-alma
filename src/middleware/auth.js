// Middleware que protege rotas exigindo um token JWT válido.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/database');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Confere se o usuário ainda existe e não foi bloqueado.
    const user = db.prepare('SELECT id, role, status FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Conta bloqueada.' });
    }
    req.user = { id: user.id, role: user.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
  }
}

// Exige privilégio administrativo (admin ou superadmin).
function adminRequired(req, res, next) {
  const role = req.user && req.user.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  return next();
}

// Exige especificamente o Super Admin (acesso total).
function superAdminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acesso restrito ao Super Admin.' });
  }
  return next();
}

module.exports = { authRequired, adminRequired, superAdminRequired };

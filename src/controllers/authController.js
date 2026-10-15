// Toda a lógica de cadastro, login e gerenciamento de senha.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/env');
const { enviarEmail } = require('../services/email');

// ---------- Helpers ----------

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function gerarToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Remove campos sensíveis antes de devolver o usuário ao frontend.
function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    birth_date: user.birth_date,
    birth_time: user.birth_time,
    birth_city: user.birth_city,
    mother_name: user.mother_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

// ---------- Cadastro ----------

function register(req, res) {
  const {
    full_name, birth_date, birth_time, birth_city,
    mother_name, email, phone, password,
  } = req.body || {};

  // Validação dos campos obrigatórios
  if (!full_name || !birth_date || !email || !password) {
    return res.status(400).json({
      error: 'Campos obrigatórios: nome completo, data de nascimento, e-mail e senha.',
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  // E-mail já cadastrado?
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
  }

  const password_hash = bcrypt.hashSync(String(password), 10);

  const stmt = db.prepare(`
    INSERT INTO users
      (full_name, birth_date, birth_time, birth_city, mother_name, email, phone, password_hash, role)
    VALUES
      (@full_name, @birth_date, @birth_time, @birth_city, @mother_name, @email, @phone, @password_hash, 'customer')
  `);

  const info = stmt.run({
    full_name: String(full_name).trim(),
    birth_date,
    birth_time: birth_time || null,
    birth_city: birth_city || null,
    mother_name: mother_name || null,
    email: email.toLowerCase().trim(),
    phone: phone || null,
    password_hash,
  });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = gerarToken(user);

  return res.status(201).json({
    message: 'Cadastro realizado com sucesso. O universo dá as boas-vindas. ✨',
    token,
    user: publicUser(user),
  });
}

// ---------- Login ----------

function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Esta conta está bloqueada. Entre em contato com o suporte.' });
  }

  const token = gerarToken(user);
  return res.json({
    message: 'Login realizado com sucesso.',
    token,
    user: publicUser(user),
  });
}

// ---------- Dados do usuário logado ----------

function me(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  return res.json({ user: publicUser(user) });
}

// ---------- Alteração de senha (logado) ----------

function changePassword(req, res) {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(String(current_password), user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  const newHash = bcrypt.hashSync(String(new_password), 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newHash, user.id);

  return res.json({ message: 'Senha alterada com sucesso.' });
}

// ---------- Recuperação de senha: solicitar token ----------
// Gera um token de redefinição válido por 1 hora.
// OBS: o envio por e-mail entra numa próxima etapa (precisa de SMTP).
// Por enquanto o token é retornado/logado para você testar o fluxo.

async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());

  // Resposta sempre genérica para não revelar se o e-mail existe.
  const genericMessage = {
    message: 'Se este e-mail estiver cadastrado, enviamos um código de 6 números. Confira também a caixa de spam.',
  };
  if (!user) return res.json(genericMessage);

  // Código de 6 números, válido por 1 hora, no máximo 5 tentativas.
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_expires_at = ?, reset_attempts = 0 WHERE id = ?')
    .run(bcrypt.hashSync(codigo, 8), expires, user.id);

  const primeiroNome = (user.full_name || '').split(' ')[0] || '';
  const r = await enviarEmail({
    para: user.email,
    nome: user.full_name,
    assunto: `Seu código: ${codigo} — Oráculo da Alma`,
    html: `<div style="font-family:Georgia,serif;background:#0c1530;color:#f3ead2;padding:28px;border-radius:14px;max-width:460px;margin:auto;border:1px solid #c9a24b">
      <h2 style="color:#e0c478;margin-top:0">Oráculo da Alma</h2>
      <p>Olá${primeiroNome ? ', ' + primeiroNome : ''}! Use o código abaixo para criar uma nova senha:</p>
      <p style="font-size:34px;letter-spacing:8px;color:#e0c478;text-align:center;margin:22px 0"><b>${codigo}</b></p>
      <p style="font-size:13px;opacity:.8">O código vale por 1 hora. Se não foi você quem pediu, ignore este e-mail.</p>
    </div>`,
  });
  if (!r.ok) console.log(`[RECUPERAÇÃO DE SENHA] E-mail não enviado para ${user.email} (${r.motivo}).`);

  const response = { ...genericMessage };
  if (process.env.NODE_ENV !== 'production') response.dev_reset_token = codigo;
  return res.json(response);
}

// ---------- Recuperação de senha: confirmar com e-mail + código ----------

function resetPassword(req, res) {
  const { email, token, new_password } = req.body || {};
  if (!email || !token || !new_password) {
    return res.status(400).json({ error: 'Informe o e-mail, o código e a nova senha.' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  const invalido = { error: 'Código inválido ou expirado. Peça um novo código.' };
  if (!user || !user.reset_token) return res.status(400).json(invalido);
  if (!user.reset_expires_at || new Date(user.reset_expires_at) < new Date()) return res.status(400).json(invalido);
  if ((user.reset_attempts || 0) >= 5) {
    return res.status(429).json({ error: 'Muitas tentativas. Peça um novo código.' });
  }
  const codigo = String(token).replace(/\D/g, '');
  if (!bcrypt.compareSync(codigo, user.reset_token)) {
    db.prepare('UPDATE users SET reset_attempts = COALESCE(reset_attempts, 0) + 1 WHERE id = ?').run(user.id);
    return res.status(400).json(invalido);
  }

  const newHash = bcrypt.hashSync(String(new_password), 10);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL, reset_attempts = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(newHash, user.id);

  return res.json({ message: 'Senha redefinida com sucesso. Você já pode entrar.' });
}

// ---------- Logout ----------
// Com JWT o logout é feito no cliente (apagando o token). Este endpoint
// existe para padronizar e permitir futura lista de revogação, se quiser.

function logout(req, res) {
  return res.json({ message: 'Sessão encerrada. Apague o token no cliente.' });
}

module.exports = {
  register,
  login,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
};

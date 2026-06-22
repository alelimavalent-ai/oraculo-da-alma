// Cria (ou promove) um usuário administrador.
// Uso:  node src/utils/createAdmin.js  email@exemplo.com  SuaSenha123
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const email = (process.argv[2] || '').toLowerCase().trim();
const senha = process.argv[3];

if (!email || !senha) {
  console.log('Uso: node src/utils/createAdmin.js <email> <senha>');
  process.exit(1);
}

(async () => {
  await db.init(); // banco sql.js precisa inicializar antes de qualquer consulta

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?").run(existing.id);
    console.log(`Usuário ${email} promovido a administrador. ✨`);
  } else {
    const hash = bcrypt.hashSync(senha, 10);
    db.prepare(`
      INSERT INTO users (full_name, birth_date, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run('Administrador', '2000-01-01', email, hash);
    console.log(`Administrador ${email} criado com sucesso. ✨`);
  }
})().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});

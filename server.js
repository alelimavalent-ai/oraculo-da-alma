// ===========================================
//  ORÁCULO DA ALMA — servidor principal
//  "O universo fala com você."
// ===========================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config/env');

// Banco de dados (sql.js) — precisa ser inicializado antes de subir o servidor.
const db = require('./src/config/database');

const authRoutes = require('./src/routes/auth');
const consultationRoutes = require('./src/routes/consultations');
const paymentRoutes = require('./src/routes/payments');
const adminRoutes = require('./src/routes/admin');
const { seedAdmin } = require('./src/utils/seedAdmin');

const app = express();

app.use(cors());
app.use(express.json());

// Frontend (arquivos estáticos da pasta /public)
app.use(express.static(path.join(__dirname, 'public')));

// Painel administrativo (Dono/Admin)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Login administrativo (a página SPA exibe a tela de login do admin)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de saúde — útil para checar se o servidor está no ar.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Oráculo da Alma', slogan: 'O universo fala com você.' });
});

// Preço atual da consulta (público, para o site mostrar o valor certo)
app.get('/api/preco', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'consultation_price_cents'").get();
  const cents = row ? parseInt(row.value, 10) : 3999;
  res.json({ cents, brl: 'R$ ' + (cents / 100).toFixed(2).replace('.', ',') });
});

// Autenticação
app.use('/api/auth', authRoutes);

// Consultas (mapa astral, védico, tarot, búzios)
app.use('/api/consultations', consultationRoutes);

// Pagamento PIX (Asaas)
app.use('/api/payments', paymentRoutes);

// Administração (inclui o endpoint temporário /api/admin/reset-master)
app.use('/api/admin', adminRoutes);

// 404 padrão para rotas de API não encontradas
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Handler de erro genérico
app.use((err, req, res, next) => {
  console.error('[ERRO]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Inicializa o banco (assíncrono) e só então sobe o servidor.
db.init()
  .then(() => {
    seedAdmin(); // garante o Super Admin permanente a cada subida
    app.listen(config.port, () => {
      console.log('==============================================');
      console.log('  ✨ ORÁCULO DA ALMA — backend no ar');
      console.log(`  http://localhost:${config.port}`);
      console.log(`  Banco: ${config.databaseAbsolutePath}`);
      console.log('==============================================');
    });
  })
  .catch((err) => {
    console.error('[ERRO] Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });

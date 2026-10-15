// Painel administrativo (somente admin/superadmin).
const db = require('../config/database');
const config = require('../config/env');
const ia = require('../services/openai');
const { tirarTarot } = require('../services/oraculos');
const { mascararCpf } = require('../utils/cpf');

// Todas as consultas, com dados do usuário (nome, e-mail, data, pergunta, resposta, status).
function listConsultations(req, res) {
  const rows = db.prepare(`
    SELECT c.id, c.type, c.category, c.status, c.payment_status, c.result_text, c.pdf_path, c.created_at,
           u.full_name, u.email
    FROM consultations c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
  `).all();
  return res.json({ consultas: rows });
}

// Lista de usuários.
function listUsers(req, res) {
  const rows = db.prepare(`
    SELECT id, full_name, email, role, status, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  return res.json({ usuarios: rows });
}

// Configurações (valor da consulta).
function getSettings(req, res) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'consultation_price_cents'").get();
  const cents = row ? parseInt(row.value, 10) : 3999;
  return res.json({
    consultation_price_cents: cents,
    consultation_price_brl: 'R$ ' + (cents / 100).toFixed(2).replace('.', ','),
  });
}

function updateSettings(req, res) {
  const { consultation_price_cents } = req.body || {};
  const v = parseInt(consultation_price_cents, 10);
  if (!Number.isFinite(v) || v < 0) {
    return res.status(400).json({ error: 'Valor inválido. Informe em centavos (ex.: 3999 = R$ 39,99).' });
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('consultation_price_cents', ?)").run(String(v));
  return res.json({
    message: 'Valor atualizado.',
    consultation_price_cents: v,
    consultation_price_brl: 'R$ ' + (v / 100).toFixed(2).replace('.', ','),
  });
}

// Status da configuração da OpenAI.
function openaiStatus(req, res) {
  const configured = !!config.openaiApiKey;
  return res.json({
    configured,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    message: configured
      ? 'OpenAI configurada corretamente.'
      : 'OPENAI_API_KEY ausente no arquivo .env. Defina a chave para liberar as interpretações por IA.',
  });
}

// Testa a qualidade da IA (tiragem de tarot + interpretação), sem custo.
async function testIA(req, res) {
  if (!config.openaiApiKey) {
    return res.status(400).json({ ok: false, error: 'OPENAI_API_KEY ausente no .env.' });
  }
  try {
    const cartas = tirarTarot(3);
    const texto = await ia.interpretarTarot(cartas, 'Conselho espiritual', 'Administrador (teste)');
    return res.json({ ok: true, cartas, resultado: texto });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message });
  }
}

// Teste real de conexão com a OpenAI (faz uma chamada mínima).
async function openaiTest(req, res) {
  try {
    const resposta = await ia.testarConexao();
    return res.json({ ok: true, resposta });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message });
  }
}

// Resumo financeiro.
function financeiro(req, res) {
  const tot = db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS c FROM payments WHERE status = 'confirmed'").get().c;
  const aprovados = db.prepare("SELECT COUNT(*) AS n FROM payments WHERE status = 'confirmed'").get().n;
  const pendentes = db.prepare("SELECT COUNT(*) AS n FROM payments WHERE status = 'pending'").get().n;
  const consultas = db.prepare('SELECT COUNT(*) AS n FROM consultations').get().n;
  const clientes = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get().n;
  return res.json({
    totalFaturadoCentavos: tot,
    totalFaturadoBrl: 'R$ ' + (tot / 100).toFixed(2).replace('.', ','),
    pagamentosAprovados: aprovados,
    pagamentosPendentes: pendentes,
    consultasRealizadas: consultas,
    clientes,
  });
}

// Grátis × Pagantes: quem fez a consulta grátis e quem pagou depois.
function gratisPagantes(req, res) {
  const brl = (c) => 'R$ ' + ((c || 0) / 100).toFixed(2).replace('.', ',');
  const rows = db.prepare(`
    SELECT c.id, c.type, c.category, c.created_at, c.pdf_paid, c.user_id,
           u.full_name, u.email, u.phone, u.cpf
    FROM consultations c
    JOIN users u ON u.id = c.user_id
    WHERE c.is_free = 1
    ORDER BY c.created_at DESC
  `).all();

  const lista = rows.map((r) => {
    const pdf = db.prepare(`
      SELECT amount_cents, confirmed_at FROM payments
      WHERE consultation_id = ? AND status = 'confirmed' ORDER BY confirmed_at DESC LIMIT 1
    `).get(r.id);
    const novas = db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(p.amount_cents), 0) AS total
      FROM consultations c JOIN payments p ON p.consultation_id = c.id
      WHERE c.user_id = ? AND c.is_free = 0 AND p.status = 'confirmed' AND p.amount_cents > 0
    `).get(r.user_id);
    const gastoCents = (pdf ? pdf.amount_cents : 0) + (novas ? novas.total : 0);
    return {
      id: r.id,
      nome: r.full_name,
      email: r.email,
      whatsapp: r.phone,
      cpf: mascararCpf(r.cpf),
      tipo: r.type,
      categoria: r.category,
      data: r.created_at,
      pagouPdf: !!r.pdf_paid,
      pdfPagoEm: pdf ? pdf.confirmed_at : null,
      consultasPagasDepois: novas ? novas.n : 0,
      pagou: !!r.pdf_paid || (novas && novas.n > 0),
      gastoBrl: brl(gastoCents),
      gastoCents,
    };
  });

  const total = lista.length;
  const pagaram = lista.filter((x) => x.pagou).length;
  const receita = lista.reduce((s, x) => s + x.gastoCents, 0);
  return res.json({
    resumo: {
      totalGratis: total,
      pagaram,
      pagaramPdf: lista.filter((x) => x.pagouPdf).length,
      voltaramComprar: lista.filter((x) => x.consultasPagasDepois > 0).length,
      conversao: total ? Math.round((pagaram / total) * 1000) / 10 : 0,
      receitaBrl: brl(receita),
    },
    lista,
  });
}

module.exports = {
  gratisPagantes,
  listConsultations,
  listUsers,
  getSettings,
  updateSettings,
  openaiStatus,
  openaiTest,
  testIA,
  financeiro,
};

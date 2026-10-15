// Esteira de consultas: criar -> pagar -> liberar (calcular + interpretar).
// Super Admin/Admin: consultas grátis e ilimitadas, geradas na hora.
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { gerarPDF } = require('../services/pdf');
const { gerarConteudo } = require('../services/geracao');
const ia = require('../services/openai');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const TIPOS_VALIDOS = ['mapa_astral', 'astrologia_vedica', 'tarot', 'buzios'];

function isAdmin(role) {
  return role === 'admin' || role === 'superadmin';
}

// Lê o valor da consulta (centavos) das configurações editáveis.
function precoCentavos() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'consultation_price_cents'").get();
  const v = row ? parseInt(row.value, 10) : 3999;
  return Number.isFinite(v) ? v : 3999;
}

function brl(cents) {
  return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

// ---------- Criar consulta ----------
async function criarConsulta(req, res) {
  const { type, category, birth } = req.body || {};
  if (!TIPOS_VALIDOS.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}.` });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const inputData = birth || {
    nome: user.full_name,
    dataNascimento: user.birth_date,
    horaNascimento: user.birth_time,
    cidadeNascimento: user.birth_city,
  };

  // ---- ADMIN: grátis, ilimitado, gerado na hora ----
  if (isAdmin(req.user.role)) {
    const insert = db.prepare(`
      INSERT INTO consultations (user_id, type, category, status, payment_status, input_json)
      VALUES (?, ?, ?, 'paid', 'gratis_admin', ?)
    `).run(req.user.id, type, category || null, JSON.stringify(inputData));
    const consultationId = insert.lastInsertRowid;

    db.prepare(`
      INSERT INTO payments (user_id, consultation_id, amount_cents, method, status)
      VALUES (?, ?, 0, 'gratis_admin', 'gratis_admin')
    `).run(req.user.id, consultationId);

    const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultationId);
    try {
      const { texto, technical } = await gerarConteudo(consultation, user);
      return res.status(201).json({
        free: true,
        consultation: { id: consultationId, type, category: category || null, status: 'completed', payment_status: 'gratis_admin' },
        resultado: texto,
        dadosTecnicos: technical,
        aviso: ia.AVISO,
      });
    } catch (err) {
      return res.status(502).json({ error: 'Erro ao gerar a consulta: ' + err.message });
    }
  }

  // ---- CLIENTE COMUM: precisa pagar PIX ----
  const price = precoCentavos();
  const insert = db.prepare(`
    INSERT INTO consultations (user_id, type, category, status, payment_status, input_json)
    VALUES (?, ?, ?, 'pending', 'pendente', ?)
  `).run(req.user.id, type, category || null, JSON.stringify(inputData));
  const consultationId = insert.lastInsertRowid;

  const pay = db.prepare(`
    INSERT INTO payments (user_id, consultation_id, amount_cents, method, status)
    VALUES (?, ?, ?, 'pix', 'pending')
  `).run(req.user.id, consultationId, price);

  return res.status(201).json({
    message: 'Consulta criada. Conclua o pagamento PIX para liberar.',
    consultation: { id: consultationId, type, category: category || null, status: 'pending', payment_status: 'pendente' },
    payment: {
      id: pay.lastInsertRowid,
      amount_cents: price,
      amount_brl: brl(price),
      method: 'pix',
      status: 'pending',
    },
    aviso: ia.AVISO,
  });
}

// ---------- Confirmar pagamento (webhook PIX em produção; admin em testes) ----------
async function confirmarPagamento(req, res) {
  const consultationId = Number(req.params.id);
  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultationId);
  if (!consultation) return res.status(404).json({ error: 'Consulta não encontrada.' });

  const payment = db.prepare('SELECT * FROM payments WHERE consultation_id = ?').get(consultationId);
  if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });

  if (consultation.status === 'completed') {
    return res.json({ message: 'Consulta já liberada.', result: consultation.result_text });
  }

  db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?").run(payment.id);
  db.prepare("UPDATE consultations SET status = 'paid', payment_status = 'pago' WHERE id = ?").run(consultationId);

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(consultation.user_id);
    const { texto } = await gerarConteudo(consultation, user);
    return res.json({ message: 'Pagamento confirmado e consulta liberada.', result: texto });
  } catch (err) {
    return res.status(502).json({ error: 'Pagamento confirmado, mas houve erro ao gerar a consulta: ' + err.message });
  }
}

// ---------- Histórico do usuário ----------
function listarConsultas(req, res) {
  const rows = db.prepare(`
    SELECT id, type, category, status, payment_status, created_at,
           (result_text IS NOT NULL) AS tem_resultado
    FROM consultations
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);
  return res.json({ consultas: rows });
}

// ---------- Detalhe de uma consulta ----------
function detalheConsulta(req, res) {
  const row = db.prepare('SELECT * FROM consultations WHERE id = ? AND user_id = ?')
    .get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Consulta não encontrada.' });
  if (row.status !== 'completed') {
    return res.status(402).json({ error: 'Consulta ainda não liberada. Conclua o pagamento.' });
  }
  return res.json({
    id: row.id,
    type: row.type,
    category: row.category,
    status: row.status,
    payment_status: row.payment_status,
    created_at: row.created_at,
    resultado: row.result_text,
    dadosTecnicos: row.technical_json ? JSON.parse(row.technical_json) : null,
    aviso: ia.AVISO,
  });
}

// ---------- Gerar e baixar o PDF premium ----------
// Gera o PDF de uma consulta liberada e salva uma cópia no histórico.
async function montarPdf(row) {
  const user = db.prepare('SELECT full_name, email FROM users WHERE id = ?').get(row.user_id);
  const buffer = await gerarPDF(row, user);
  const dir = path.resolve(process.cwd(), 'data', 'pdfs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `consulta_${row.id}.pdf`);
  fs.writeFileSync(file, buffer);
  db.prepare('UPDATE consultations SET pdf_path = ? WHERE id = ?').run(file, row.id);
  return buffer;
}

function buscarConsultaDoUsuario(req, id) {
  return isAdmin(req.user.role)
    ? db.prepare('SELECT * FROM consultations WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM consultations WHERE id = ? AND user_id = ?').get(id, req.user.id);
}

async function baixarPdf(req, res) {
  const id = Number(req.params.id);
  const row = buscarConsultaDoUsuario(req, id);
  if (!row) return res.status(404).json({ error: 'Consulta não encontrada.' });
  if (row.status !== 'completed') {
    return res.status(402).json({ error: 'Consulta ainda não liberada. Conclua o pagamento.' });
  }
  try {
    const buffer = await montarPdf(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="oraculo-da-alma-${id}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar o PDF: ' + err.message });
  }
}

// Link temporário (2 horas) para abrir o PDF fora do Instagram/Facebook,
// onde o navegador interno não deixa baixar arquivos.
function linkPdf(req, res) {
  const id = Number(req.params.id);
  const row = buscarConsultaDoUsuario(req, id);
  if (!row) return res.status(404).json({ error: 'Consulta não encontrada.' });
  if (row.status !== 'completed') {
    return res.status(402).json({ error: 'Consulta ainda não liberada. Conclua o pagamento.' });
  }
  const t = jwt.sign({ pdf: id }, config.jwtSecret, { expiresIn: '2h' });
  const host = req.get('x-forwarded-host') || req.get('host');
  const url = `https://${host}/api/consultations/${id}/pdf/abrir?t=${encodeURIComponent(t)}`;
  return res.json({ url });
}

// Abre o PDF pelo link temporário (sem login), para salvar/compartilhar no Safari ou Chrome.
async function abrirPdfPorLink(req, res) {
  const id = Number(req.params.id);
  try {
    const payload = jwt.verify(String(req.query.t || ''), config.jwtSecret);
    if (payload.pdf !== id) throw new Error('link inválido');
  } catch (e) {
    return res.status(401).send('Link expirado. Volte ao Oráculo da Alma e toque em "Baixar relatório premium" de novo.');
  }
  const row = db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
  if (!row || row.status !== 'completed') return res.status(404).send('Relatório não encontrado.');
  try {
    const buffer = await montarPdf(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="oraculo-da-alma-${id}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).send('Erro ao gerar o PDF: ' + err.message);
  }
}

module.exports = {
  criarConsulta,
  confirmarPagamento,
  listarConsultas,
  detalheConsulta,
  baixarPdf,
  linkPdf,
  abrirPdfPorLink,
};

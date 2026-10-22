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
const { soDigitos, cpfValido } = require('../utils/cpf');
const { consultasPorPacote, creditosDoUsuario, usarCredito, devolverCredito } = require('../services/creditos');

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

  // ---- CLIENTE: 1ª consulta grátis (1 por CPF). O PDF é pago à parte. ----
  // A consulta grátis só existe se GRATIS_ATIVO=1 no Render (hoje: desligada).
  if (req.body && req.body.gratis && process.env.GRATIS_ATIVO === '1') {
    const cpf = soDigitos(req.body.cpf);
    const whatsapp = soDigitos(req.body.whatsapp);
    if (!cpfValido(cpf)) return res.status(400).json({ error: 'CPF inválido. Confira os números.' });
    if (whatsapp.length < 10) return res.status(400).json({ error: 'Informe o WhatsApp com DDD.' });
    const jaUsouConta = db.prepare('SELECT id FROM consultations WHERE user_id = ? AND is_free = 1').get(req.user.id);
    if (jaUsouConta) return res.status(409).json({ error: 'Você já usou sua consulta grátis.', gratisUsada: true });
    const jaUsouCpf = db.prepare('SELECT cpf FROM gratis_cpf WHERE cpf = ?').get(cpf);
    if (jaUsouCpf) return res.status(409).json({ error: 'Este CPF já usou a consulta grátis.', gratisUsada: true });

    const ins = db.prepare(`
      INSERT INTO consultations (user_id, type, category, status, payment_status, input_json, is_free, pdf_paid)
      VALUES (?, ?, ?, 'paid', 'gratis', ?, 1, 0)
    `).run(req.user.id, type, category || null, JSON.stringify(inputData));
    const consultationId = ins.lastInsertRowid;
    db.prepare('INSERT INTO gratis_cpf (cpf, user_id, consultation_id) VALUES (?, ?, ?)').run(cpf, req.user.id, consultationId);
    db.prepare('UPDATE users SET cpf = ?, phone = ? WHERE id = ?').run(cpf, whatsapp, req.user.id);

    const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultationId);
    try {
      const { texto, technical } = await gerarConteudo(consultation, user);
      return res.status(201).json({
        free: true,
        gratis: true,
        pdfBloqueado: true,
        precoPdfBrl: brl(precoCentavos()),
        consultation: { id: consultationId, type, category: category || null, status: 'completed', payment_status: 'gratis' },
        resultado: texto,
        dadosTecnicos: technical,
        aviso: ia.AVISO,
      });
    } catch (err) {
      // Falhou a geração: libera a grátis de novo para a pessoa tentar outra vez.
      db.prepare('DELETE FROM gratis_cpf WHERE consultation_id = ?').run(consultationId);
      db.prepare('DELETE FROM consultations WHERE id = ?').run(consultationId);
      return res.status(502).json({ error: 'Erro ao gerar a consulta. Tente novamente em instantes.' });
    }
  }

  // ---- CLIENTE COM CRÉDITO (consulta que sobrou do pacote): libera na hora ----
  if (usarCredito(req.user.id)) {
    const ins = db.prepare(`
      INSERT INTO consultations (user_id, type, category, status, payment_status, input_json)
      VALUES (?, ?, ?, 'paid', 'credito', ?)
    `).run(req.user.id, type, category || null, JSON.stringify(inputData));
    const consultationId = ins.lastInsertRowid;
    const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultationId);
    try {
      const { texto, technical } = await gerarConteudo(consultation, user);
      return res.status(201).json({
        free: true,
        credito: true,
        creditos: creditosDoUsuario(req.user.id),
        consultation: { id: consultationId, type, category: category || null, status: 'completed', payment_status: 'credito' },
        resultado: texto,
        dadosTecnicos: technical,
        aviso: ia.AVISO,
      });
    } catch (err) {
      devolverCredito(req.user.id);
      db.prepare('DELETE FROM consultations WHERE id = ?').run(consultationId);
      return res.status(502).json({ error: 'Erro ao gerar a consulta. Seu crédito foi mantido — tente novamente.' });
    }
  }

  // ---- CLIENTE SEM CRÉDITO: paga o pacote por PIX ----
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
    porPacote: consultasPorPacote(),
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
    SELECT id, type, category, status, payment_status, created_at, is_free, pdf_paid,
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
    is_free: row.is_free,
    pdf_paid: row.pdf_paid,
    pdfBloqueado: !!row.is_free && !row.pdf_paid,
    precoPdfBrl: brl(precoCentavos()),
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

// Consulta grátis: o PDF só sai depois de pago.
function pdfLiberado(req, row) {
  return isAdmin(req.user.role) || !row.is_free || !!row.pdf_paid;
}
function respostaPdfBloqueado(res) {
  return res.status(402).json({
    error: `Libere seu relatório premium em PDF por ${brl(precoCentavos())}.`,
    precisaPagar: true,
    precoPdfBrl: brl(precoCentavos()),
  });
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
  if (!pdfLiberado(req, row)) return respostaPdfBloqueado(res);
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
  if (!pdfLiberado(req, row)) return respostaPdfBloqueado(res);
  const t = jwt.sign({ pdf: id }, config.jwtSecret, { expiresIn: '2h' });
  const host = req.get('x-forwarded-host') || req.get('host');
  const url = `https://${host}/api/consultations/${id}/pdf/abrir?t=${encodeURIComponent(t)}`;
  return res.json({ url });
}

// Valida o link temporário e devolve a consulta (ou null).
function consultaPorLink(req) {
  const id = Number(req.params.id);
  try {
    const payload = jwt.verify(String(req.query.t || ''), config.jwtSecret);
    if (payload.pdf !== id) return null;
  } catch (e) {
    return null;
  }
  const row = db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
  if (!row || row.status !== 'completed') return null;
  if (row.is_free && !row.pdf_paid) return null;
  return row;
}

const NOME_ARQUIVO = 'Oraculo-da-Alma-Relatorio.pdf';
const MSG_EXPIRADO = 'Link expirado. Volte ao Oráculo da Alma e toque em "Baixar relatório premium" de novo.';

// Página de entrega (abre no Safari/Chrome) com botão grande "Baixar meu relatório".
function abrirPdfPorLink(req, res) {
  const row = consultaPorLink(req);
  if (!row) return res.status(401).send(MSG_EXPIRADO);
  const t = encodeURIComponent(String(req.query.t));
  const arq = `/api/consultations/${row.id}/pdf/${NOME_ARQUIVO}?t=${t}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu relatório — Oráculo da Alma</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Spectral:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
    font-family:'Spectral',Georgia,serif;color:#f3ead2;
    background:radial-gradient(circle at 50% 0%,#1a2752,#080f24 70%)}
  .card{max-width:420px;width:100%;text-align:center;padding:32px 22px;border:1px solid #c9a24b;
    border-radius:18px;background:rgba(12,21,48,.92);box-shadow:0 0 0 4px rgba(201,162,75,.12)}
  h1{font-family:'Cinzel',serif;color:#e0c478;font-size:1.35rem;letter-spacing:.06em;margin:8px 0 6px}
  p{line-height:1.5;margin:8px 0 22px}
  .btn{display:block;width:100%;padding:18px;border-radius:12px;font-family:'Cinzel',serif;font-size:1.05rem;
    letter-spacing:.05em;text-decoration:none;border:1px solid #c9a24b;margin-top:12px;cursor:pointer}
  .ouro{background:linear-gradient(180deg,#e0c478,#c9a24b);color:#1a1405;font-weight:600}
  .vazado{background:transparent;color:#e0c478}
  small{display:block;margin-top:18px;opacity:.7;font-size:.85rem}
  .ok{color:#9fe0a8;margin-top:14px;display:none}
</style></head>
<body><div class="card">
  <div style="font-size:2.4rem">🌙</div>
  <h1>Seu relatório está pronto</h1>
  <p id="txt">Toque no botão abaixo para salvar o seu relatório premium no celular.</p>
  <a class="btn ouro" id="baixar" href="${arq}&baixar=1" download="${NOME_ARQUIVO}">⬇️ Baixar meu relatório</a>
  <a class="btn vazado" href="${arq}">👁️ Ver relatório</a>
  <div class="ok" id="ok">No menu que abrir, toque em <b>Salvar em Arquivos</b> (ou envie pelo WhatsApp).</div>
  <small>Oráculo da Alma · o link vale por 2 horas</small>
</div>
<script>
  var ehIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var arquivo = null;
  // Já deixa o PDF carregado, para o menu do iPhone abrir na hora do toque.
  if (ehIOS && navigator.share) {
    fetch(${JSON.stringify(arq)}).then(function(r){ return r.blob(); }).then(function(b){
      var f = new File([b], ${JSON.stringify(NOME_ARQUIVO)}, {type:'application/pdf'});
      if (!navigator.canShare || navigator.canShare({files:[f]})) arquivo = f;
    }).catch(function(){});
  }
  document.getElementById('baixar').addEventListener('click', function(ev){
    if (!ehIOS) return; // Android/PC: download normal
    if (arquivo) {
      ev.preventDefault();
      document.getElementById('ok').style.display = 'block';
      navigator.share({ files: [arquivo], title: 'Meu relatório — Oráculo da Alma' }).catch(function(){});
    } else {
      // PDF ainda carregando: abre o PDF e mostra como salvar.
      document.getElementById('ok').innerHTML = 'Toque no ícone de compartilhar do Safari e depois em <b>Salvar em Arquivos</b>.';
      document.getElementById('ok').style.display = 'block';
    }
  });
</script>
</body></html>`);
}

// Entrega o arquivo PDF pelo link temporário. ?baixar=1 força o download.
async function arquivoPdfPorLink(req, res) {
  const row = consultaPorLink(req);
  if (!row) return res.status(401).send(MSG_EXPIRADO);
  try {
    const buffer = await montarPdf(row);
    res.setHeader('Content-Type', 'application/pdf');
    const modo = req.query.baixar ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${modo}; filename="${NOME_ARQUIVO}"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).send('Erro ao gerar o PDF: ' + err.message);
  }
}

// A pessoa ainda tem a consulta grátis?
function statusGratis(req, res) {
  if (isAdmin(req.user.role)) return res.json({ disponivel: false, admin: true });
  const usada = db.prepare('SELECT id FROM consultations WHERE user_id = ? AND is_free = 1').get(req.user.id);
  return res.json({
    disponivel: process.env.GRATIS_ATIVO === '1' && !usada,
    precoBrl: brl(precoCentavos()),
    creditos: creditosDoUsuario(req.user.id),
    porPacote: consultasPorPacote(),
  });
}

module.exports = {
  statusGratis,
  criarConsulta,
  confirmarPagamento,
  listarConsultas,
  detalheConsulta,
  baixarPdf,
  linkPdf,
  abrirPdfPorLink,
  arquivoPdfPorLink,
};

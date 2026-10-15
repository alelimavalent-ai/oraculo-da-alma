// Esteira de pagamento PIX (Asaas): gerar cobrança -> consultar status -> liberar.
const { DateTime } = require('luxon');
const db = require('../config/database');
const asaas = require('../services/asaas');
const { gerarConteudo } = require('../services/geracao');

function precoCentavos() {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'consultation_price_cents'").get();
  const v = r ? parseInt(r.value, 10) : 3999;
  return Number.isFinite(v) ? v : 3999;
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

// ---------- Gerar cobrança PIX ----------
async function gerarPix(req, res) {
  const { consultationId, nome, cpf, whatsapp } = req.body || {};
  if (!consultationId || !nome || !cpf || !whatsapp) {
    return res.status(400).json({ error: 'Informe nome, CPF e WhatsApp.' });
  }

  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ? AND user_id = ?')
    .get(Number(consultationId), req.user.id);
  if (!consultation) return res.status(404).json({ error: 'Consulta não encontrada.' });
  // Consulta grátis: o PIX é para liberar o relatório em PDF.
  const compraPdf = !!consultation.is_free;
  if (compraPdf && consultation.pdf_paid) return res.json({ jaLiberada: true, pdf: true });
  if (!compraPdf && consultation.status === 'completed') return res.json({ jaLiberada: true });

  const payment = db.prepare('SELECT * FROM payments WHERE consultation_id = ?').get(consultation.id);
  const cents = compraPdf ? precoCentavos() : (payment ? payment.amount_cents : precoCentavos());
  const valor = Number((cents / 100).toFixed(2));

  // Já existe uma cobrança desta consulta? Não cria outra (evita o cliente pagar duas vezes).
  if (payment && payment.provider_txid && payment.status !== 'confirmed') {
    try {
      const st = await asaas.consultarStatus(payment.provider_txid);
      if (st.status === 'aprovado') {
        db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?").run(payment.id);
        if (compraPdf) {
          db.prepare("UPDATE consultations SET pdf_paid = 1, payment_status = 'pdf_pago' WHERE id = ?").run(consultation.id);
          return res.json({ jaLiberada: true, pdf: true });
        }
        db.prepare("UPDATE consultations SET status = 'paid', payment_status = 'pago' WHERE id = ?").run(consultation.id);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(consultation.user_id);
        await gerarConteudo(db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultation.id), user);
        return res.json({ jaLiberada: true });
      }
      if (st.status === 'pendente' && Number(st.value) === valor) {
        const qr = await asaas.pegarQrCode(payment.provider_txid);
        return res.json({ ...qr, value: valor, valueBrl: 'R$ ' + valor.toFixed(2).replace('.', ','), status: 'pendente' });
      }
    } catch (e) { /* cobrança antiga inválida: segue e cria uma nova */ }
  }

  const dueDate = DateTime.now().setZone('America/Sao_Paulo').toISODate();

  try {
    const cob = await asaas.criarCobrancaPix({
      nome,
      cpf: soDigitos(cpf),
      whatsapp: soDigitos(whatsapp),
      valor,
      descricao: compraPdf ? 'Relatório premium em PDF — Oráculo da Alma' : 'Consulta Oráculo da Alma',
      dueDate,
    });

    if (payment) {
      db.prepare("UPDATE payments SET provider_txid = ?, status = 'pending', amount_cents = ? WHERE id = ?")
        .run(cob.asaasId, cents, payment.id);
    } else {
      db.prepare(`
        INSERT INTO payments (user_id, consultation_id, amount_cents, method, status, provider_txid)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `).run(req.user.id, consultation.id, cents, compraPdf ? 'pix_pdf' : 'pix', cob.asaasId);
    }
    // Guarda o WhatsApp e o CPF do cliente.
    db.prepare('UPDATE users SET phone = ?, cpf = COALESCE(cpf, ?) WHERE id = ?').run(whatsapp, soDigitos(cpf), req.user.id);

    return res.json({
      qrCodeImage: cob.qrCodeImage,
      copiaECola: cob.copiaECola,
      value: valor,
      valueBrl: 'R$ ' + valor.toFixed(2).replace('.', ','),
      status: 'pendente',
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

// ---------- Consultar status e liberar quando aprovado ----------
async function statusPix(req, res) {
  const consultationId = Number(req.params.id);
  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ? AND user_id = ?')
    .get(consultationId, req.user.id);
  if (!consultation) return res.status(404).json({ error: 'Consulta não encontrada.' });
  const compraPdf = !!consultation.is_free;
  if (compraPdf && consultation.pdf_paid) return res.json({ status: 'aprovado', released: true, pdf: true });
  if (!compraPdf && consultation.status === 'completed') return res.json({ status: 'aprovado', released: true });

  const payment = db.prepare('SELECT * FROM payments WHERE consultation_id = ?').get(consultationId);
  if (!payment || !payment.provider_txid) {
    return res.status(400).json({ error: 'Cobrança PIX ainda não gerada.' });
  }

  try {
    const st = await asaas.consultarStatus(payment.provider_txid);
    if (st.status === 'aprovado' && compraPdf) {
      db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?").run(payment.id);
      db.prepare("UPDATE consultations SET pdf_paid = 1, payment_status = 'pdf_pago' WHERE id = ?").run(consultationId);
      return res.json({ status: 'aprovado', released: true, pdf: true });
    }
    if (st.status === 'aprovado') {
      db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?").run(payment.id);
      db.prepare("UPDATE consultations SET status = 'paid', payment_status = 'pago' WHERE id = ?").run(consultationId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(consultation.user_id);
      const fresh = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultationId);
      try {
        await gerarConteudo(fresh, user);
        return res.json({ status: 'aprovado', released: true });
      } catch (e) {
        return res.status(502).json({ status: 'aprovado', released: false, error: 'Pagamento aprovado, mas houve erro ao gerar a consulta: ' + e.message });
      }
    }
    return res.json({ status: st.status });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

module.exports = { gerarPix, statusPix };

// Envio de e-mail pela API da Brevo (HTTP — funciona no Render, que bloqueia SMTP no plano grátis).
// Configure no Render: BREVO_API_KEY e EMAIL_REMETENTE (e-mail validado na Brevo).
async function enviarEmail({ para, nome, assunto, html }) {
  const key = process.env.BREVO_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;
  if (!key || !remetente) {
    console.warn('[EMAIL] BREVO_API_KEY/EMAIL_REMETENTE não configurados — e-mail não enviado.');
    return { ok: false, motivo: 'nao_configurado' };
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Oráculo da Alma', email: remetente },
      to: [{ email: para, name: nome || para }],
      subject: assunto,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[EMAIL] Falha ao enviar:', res.status, t.slice(0, 300));
    return { ok: false, motivo: 'erro_envio' };
  }
  return { ok: true };
}

function emailConfigurado() {
  return !!(process.env.BREVO_API_KEY && process.env.EMAIL_REMETENTE);
}

module.exports = { enviarEmail, emailConfigurado };

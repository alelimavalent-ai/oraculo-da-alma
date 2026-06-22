/* =========================================================
   ORÁCULO DA ALMA — lógica do frontend
   ========================================================= */

const API = ''; // mesma origem do backend
const TOKEN_KEY = 'oraculo_token';
const USER_KEY = 'oraculo_user';

// Estado da consulta em andamento
let fluxo = { type: null, category: null, consultationId: null, birth: null };

// ---------- Util ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function token() { return localStorage.getItem(TOKEN_KEY); }
function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function alertBox(elId, type, msg) {
  const el = $('#' + elId);
  if (!el) return;
  el.innerHTML = msg ? `<div class="alert ${type}">${msg}</div>` : '';
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token()) headers.Authorization = 'Bearer ' + token();
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Algo deu errado. Tente novamente.');
  return data;
}

// ---------- Roteador ----------
function show(viewId) {
  $$('.view').forEach((v) => v.classList.add('hidden'));
  const view = $('#' + viewId);
  if (view) view.classList.remove('hidden');
  // Topbar só aparece logado e fora das telas de entrada
  const logged = !!token();
  const entryViews = ['view-home', 'view-login', 'view-admin-login', 'view-register', 'view-forgot', 'view-reset'];
  $('#topbar').classList.toggle('hidden', !logged || entryViews.includes(viewId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Botões com data-go
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { show(go.dataset.go); }
});

// ---------- Autenticação ----------
$('#btnRegister').addEventListener('click', async () => {
  alertBox('reg-alert', '', '');
  const body = {
    full_name: $('#reg-full_name').value.trim(),
    birth_date: $('#reg-birth_date').value,
    birth_time: $('#reg-birth_time').value,
    birth_city: $('#reg-birth_city').value.trim(),
    mother_name: $('#reg-mother_name').value.trim(),
    email: $('#reg-email').value.trim(),
    phone: $('#reg-phone').value.trim(),
    password: $('#reg-password').value,
  };
  if (!body.full_name || !body.birth_date || !body.email || !body.password) {
    return alertBox('reg-alert', 'err', 'Preencha nome, data de nascimento, e-mail e senha.');
  }
  try {
    const data = await api('/api/auth/register', { method: 'POST', body, auth: false });
    setSession(data.token, data.user);
    enterApp();
  } catch (err) {
    alertBox('reg-alert', 'err', err.message);
  }
});

$('#btnLogin').addEventListener('click', async () => {
  alertBox('login-alert', '', '');
  const body = { email: $('#login-email').value.trim(), password: $('#login-password').value };
  try {
    const data = await api('/api/auth/login', { method: 'POST', body, auth: false });
    setSession(data.token, data.user);
    enterApp();
  } catch (err) {
    alertBox('login-alert', 'err', err.message);
  }
});

$('#btnAdminLogin').addEventListener('click', async () => {
  alertBox('adminlogin-alert', '', '');
  const body = { email: $('#adminlogin-email').value.trim(), password: $('#adminlogin-password').value };
  try {
    const data = await api('/api/auth/login', { method: 'POST', body, auth: false });
    if (data.user.role !== 'admin' && data.user.role !== 'superadmin') {
      return alertBox('adminlogin-alert', 'err', 'Esta conta não tem acesso administrativo.');
    }
    setSession(data.token, data.user);
    enterApp();
  } catch (err) {
    alertBox('adminlogin-alert', 'err', err.message);
  }
});

$('#btnForgot').addEventListener('click', async () => {
  alertBox('forgot-alert', '', '');
  try {
    const data = await api('/api/auth/forgot-password', {
      method: 'POST', auth: false, body: { email: $('#forgot-email').value.trim() },
    });
    let msg = data.message;
    if (data.dev_reset_token) msg += `<br><br><strong>Código (modo teste):</strong> ${data.dev_reset_token}`;
    alertBox('forgot-alert', 'ok', msg);
  } catch (err) {
    alertBox('forgot-alert', 'err', err.message);
  }
});

$('#btnReset').addEventListener('click', async () => {
  alertBox('reset-alert', '', '');
  try {
    const data = await api('/api/auth/reset-password', {
      method: 'POST', auth: false,
      body: { token: $('#reset-token').value.trim(), new_password: $('#reset-password').value },
    });
    alertBox('reset-alert', 'ok', data.message + ' Redirecionando…');
    setTimeout(() => show('view-login'), 1500);
  } catch (err) {
    alertBox('reset-alert', 'err', err.message);
  }
});

$('#btnSair').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  clearSession();
  show('view-home');
});

function enterApp() {
  const user = getUser();
  $('#greeting').textContent = user ? `Olá, ${user.full_name.split(' ')[0]}` : 'Bem-vindo(a)';
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');
  const isSuper = user && user.role === 'superadmin';

  // Selo SUPER ADMIN
  const badge = document.getElementById('superAdminBadge');
  if (badge) badge.classList.toggle('hidden', !isSuper);

  // Botão "Admin" no topo
  const topAdmin = document.getElementById('btnTopAdmin');
  if (topAdmin) topAdmin.classList.toggle('hidden', !isAdmin);

  // Subtítulo: grátis para admin, preço para cliente
  const sub = document.getElementById('consultaSubtitle');
  if (sub) {
    sub.innerHTML = isAdmin
      ? 'Consultas <strong style="color:#d8c7ef">grátis e ilimitadas</strong> (modo administrador).'
      : 'Escolha sua consulta. Cada leitura custa <strong style="color:var(--gold-2)">R$ 39,99</strong>.';
  }

  // Botão para o painel administrativo
  let adminBtn = document.getElementById('btnAdminPanel');
  if (isAdmin && !adminBtn) {
    adminBtn = document.createElement('a');
    adminBtn.id = 'btnAdminPanel';
    adminBtn.href = '/admin';
    adminBtn.className = 'btn ghost mt';
    adminBtn.textContent = 'Painel administrativo';
    const histBtn = document.getElementById('btnHist');
    if (histBtn && histBtn.parentNode) histBtn.parentNode.insertBefore(adminBtn, histBtn);
  } else if (!isAdmin && adminBtn) {
    adminBtn.remove();
  }

  show('view-app');
}

// ---------- Escolha de consulta ----------
const CATEGORIAS = {
  tarot: ['Amor', 'Trabalho', 'Finanças', 'Saúde', 'Família', 'Conselho espiritual'],
  buzios: ['Consulta geral', 'Amor', 'Prosperidade', 'Trabalho', 'Caminhos espirituais', 'Proteção'],
};

$$('[data-consulta]').forEach((tile) => {
  tile.addEventListener('click', () => {
    fluxo = { type: tile.dataset.consulta, category: null, consultationId: null, birth: null };
    if (fluxo.type === 'mapa_astral' || fluxo.type === 'astrologia_vedica') {
      prepararNascimento();
      show('view-birth');
    } else {
      montarCategorias();
      show('view-category');
    }
  });
});

function prepararNascimento() {
  const user = getUser() || {};
  $('#b-nome').value = user.full_name || '';
  $('#b-data').value = user.birth_date || '';
  $('#b-hora').value = user.birth_time || '';
  $('#b-cidade').value = user.birth_city || '';
  $('#birth-title').textContent = fluxo.type === 'mapa_astral' ? 'Mapa Astral' : 'Astrologia Védica';
  alertBox('birth-alert', '', '');
}

function montarCategorias() {
  $('#cat-title').textContent = fluxo.type === 'tarot' ? 'Tarot — escolha o tema' : 'Búzios — escolha o tema';
  const list = $('#cat-list');
  list.innerHTML = '';
  CATEGORIAS[fluxo.type].forEach((cat) => {
    const b = document.createElement('button');
    b.className = 'tile';
    b.innerHTML = `<h3>${cat}</h3>`;
    b.addEventListener('click', () => { fluxo.category = cat; criarConsulta(); });
    list.appendChild(b);
  });
}

// Geocodificação da cidade (OpenStreetMap / Nominatim, gratuito)
async function geocodificar(cidade) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cidade)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  const arr = await res.json();
  if (!arr.length) throw new Error('Não encontramos essa cidade. Tente "Cidade, Estado".');
  return { latitude: parseFloat(arr[0].lat), longitude: parseFloat(arr[0].lon) };
}

$('#btnBirthNext').addEventListener('click', async () => {
  alertBox('birth-alert', '', '');
  const cidade = $('#b-cidade').value.trim();
  const data = $('#b-data').value;
  const hora = $('#b-hora').value;
  if (!data || !hora || !cidade) {
    return alertBox('birth-alert', 'err', 'Data, hora e cidade de nascimento são necessárias para o cálculo.');
  }
  $('#btnBirthNext').disabled = true;
  $('#btnBirthNext').textContent = 'Localizando cidade…';
  try {
    const coords = await geocodificar(cidade);
    fluxo.birth = {
      nome: $('#b-nome').value.trim(),
      dataNascimento: data,
      horaNascimento: hora,
      cidadeNascimento: cidade,
      paisNascimento: 'Brasil',
      timezone: $('#b-tz').value,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    await criarConsulta();
  } catch (err) {
    alertBox('birth-alert', 'err', err.message);
  } finally {
    $('#btnBirthNext').disabled = false;
    $('#btnBirthNext').textContent = 'Continuar para o pagamento';
  }
});

// ---------- Criar consulta + pagamento ----------
async function criarConsulta() {
  try {
    const body = { type: fluxo.type, category: fluxo.category, birth: fluxo.birth };
    const data = await api('/api/consultations', { method: 'POST', body });

    // Admin: consulta grátis já gerada — mostra o resultado direto.
    if (data.free && data.resultado) {
      const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
      mostrarResultado({
        id: data.consultation.id,
        type: data.consultation.type,
        category: data.consultation.category,
        created_at: agora,
        resultado: data.resultado,
        aviso: data.aviso,
      });
      return;
    }

    fluxo.consultationId = data.consultation.id;
    iniciarTelaPix(data.payment);
  } catch (err) {
    if (fluxo.birth) alertBox('birth-alert', 'err', err.message);
    else alert(err.message);
  }
}

// Prepara a tela de pagamento (passo 1: dados)
let pixPollTimer = null;
function iniciarTelaPix(payment) {
  const user = getUser() || {};
  $('#pix-nome').value = user.full_name || '';
  $('#pix-form').classList.remove('hidden');
  $('#pix-pay').classList.add('hidden');
  alertBox('pix-form-alert', '', '');
  alertBox('pay-alert', '', '');
  if (payment && payment.amount_brl) $('#pay-price').textContent = payment.amount_brl;
  if (pixPollTimer) { clearInterval(pixPollTimer); pixPollTimer = null; }
  show('view-payment');
}

// Passo 2: gera o PIX no Asaas
$('#btnGerarPix').addEventListener('click', async () => {
  alertBox('pix-form-alert', '', '');
  const nome = $('#pix-nome').value.trim();
  const cpf = $('#pix-cpf').value.trim();
  const whatsapp = $('#pix-whats').value.trim();
  if (!nome || !cpf || !whatsapp) {
    return alertBox('pix-form-alert', 'err', 'Preencha nome, CPF e WhatsApp.');
  }
  const btn = $('#btnGerarPix');
  btn.disabled = true; btn.textContent = 'Gerando PIX…';
  try {
    const data = await api('/api/payments/pix', {
      method: 'POST',
      body: { consultationId: fluxo.consultationId, nome, cpf, whatsapp },
    });
    if (data.jaLiberada) { await abrirResultado(fluxo.consultationId); return; }
    $('#pix-qr-img').src = data.qrCodeImage || '';
    $('#pix-copia').value = data.copiaECola || '';
    if (data.valueBrl) $('#pay-price').textContent = data.valueBrl;
    $('#pix-form').classList.add('hidden');
    $('#pix-pay').classList.remove('hidden');
    iniciarPolling(fluxo.consultationId);
  } catch (err) {
    alertBox('pix-form-alert', 'err', err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Gerar PIX';
  }
});

// Copiar o código PIX
$('#btnCopiaCola').addEventListener('click', () => {
  const t = $('#pix-copia');
  t.select();
  try { document.execCommand('copy'); } catch (e) {}
  if (navigator.clipboard) navigator.clipboard.writeText(t.value).catch(() => {});
  $('#btnCopiaCola').textContent = 'Copiado!';
  setTimeout(() => { $('#btnCopiaCola').textContent = 'Copiar código PIX'; }, 1800);
});

// Consulta o status a cada 5s até aprovar
function iniciarPolling(consultationId) {
  if (pixPollTimer) clearInterval(pixPollTimer);
  pixPollTimer = setInterval(async () => {
    try {
      const r = await api('/api/payments/status/' + consultationId);
      if (r.status === 'aprovado' && r.released) {
        clearInterval(pixPollTimer); pixPollTimer = null;
        $('#pay-status').textContent = 'aprovado ✓';
        await abrirResultado(consultationId);
      } else {
        $('#pay-status').textContent = 'aguardando pagamento…';
      }
    } catch (e) { /* segue tentando */ }
  }, 5000);
}

async function abrirResultado(consultationId) {
  try {
    const data = await api('/api/consultations/' + consultationId);
    mostrarResultado(data);
  } catch (err) {
    alertBox('pay-alert', 'err', err.message);
  }
}

// Cancelar interrompe o polling
$('#btnCancelarPix').addEventListener('click', () => {
  if (pixPollTimer) { clearInterval(pixPollTimer); pixPollTimer = null; }
});

// ---------- Resultado ----------
let _consultaAtualId = null;

function mostrarResultado(data) {
  _consultaAtualId = data.id || null;
  const tipos = { mapa_astral: 'Mapa Astral', astrologia_vedica: 'Astrologia Védica', tarot: 'Tarot', buzios: 'Búzios' };
  $('#result-meta').textContent =
    `${tipos[data.type] || data.type}${data.category ? ' · ' + data.category : ''} · ${new Date(data.created_at + 'Z').toLocaleDateString('pt-BR')}`;
  $('#result-text').textContent = data.resultado || '';
  $('#result-disclaimer').textContent = data.aviso || '';
  const pdfBtn = document.getElementById('btnBaixarPdf');
  if (pdfBtn) pdfBtn.classList.toggle('hidden', !_consultaAtualId);
  show('view-result');
}

async function baixarPDF(id) {
  if (!id) return;
  const btn = document.getElementById('btnBaixarPdf');
  const txt = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando PDF…'; }
  try {
    const res = await fetch('/api/consultations/' + id + '/pdf', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Erro ao gerar o PDF.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'oraculo-da-alma-' + id + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txt; }
  }
}

document.getElementById('btnBaixarPdf') &&
  document.getElementById('btnBaixarPdf').addEventListener('click', () => baixarPDF(_consultaAtualId));

// ---------- Histórico ----------
$('#btnHist') && $('#btnHist').addEventListener('click', carregarHistorico);

async function carregarHistorico() {
  show('view-history');
  const list = $('#hist-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await api('/api/consultations');
    if (!data.consultas.length) {
      list.innerHTML = '<p class="muted center">Você ainda não fez consultas. O universo aguarda. ✨</p>';
      return;
    }
    const tipos = { mapa_astral: 'Mapa Astral', astrologia_vedica: 'Astrologia Védica', tarot: 'Tarot', buzios: 'Búzios' };
    list.innerHTML = '';
    data.consultas.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'hist-item';
      const done = c.status === 'completed';
      row.innerHTML = `
        <div>
          <div class="tipo">${tipos[c.type] || c.type}${c.category ? ' · ' + c.category : ''}</div>
          <div class="data">${new Date(c.created_at + 'Z').toLocaleString('pt-BR')}</div>
        </div>
        <span class="badge ${done ? 'done' : 'wait'}">${done ? 'Liberada' : 'Pendente'}</span>`;
      if (done) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', async () => {
          try { mostrarResultado(await api('/api/consultations/' + c.id)); }
          catch (err) { alert(err.message); }
        });
      }
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div class="alert err">${err.message}</div>`;
  }
}

// ---------- Céu estrelado ----------
function starfield() {
  const canvas = $('#starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = Math.min(160, Math.floor((canvas.width * canvas.height) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.6 + 0.2,
      tw: Math.random() * 0.02 + 0.005,
      dir: Math.random() > 0.5 ? 1 : -1,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      if (!reduce) {
        s.a += s.tw * s.dir;
        if (s.a > 0.85 || s.a < 0.15) s.dir *= -1;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(224, 196, 120, ${s.a})`;
      ctx.fill();
    }
    if (!reduce) requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize', resize);
  draw();
}

// ---------- Início ----------
starfield();
const path = location.pathname;
if (path === '/admin/login') {
  show('view-admin-login');
} else if (token()) {
  enterApp();
} else {
  show('view-home');
}

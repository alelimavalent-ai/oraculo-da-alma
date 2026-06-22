// ============================================================
//  Integração Asaas — cobrança PIX.
//  A chave fica SOMENTE no .env (ASAAS_API_KEY), nunca no código.
//  Usa o fetch nativo do Node 18+.
// ============================================================
const config = require('../config/env');

const BASE = config.asaas.baseUrl;       // ex.: https://api.asaas.com/v3 (produção) ou sandbox
const KEY = config.asaas.apiKey;

async function asaasReq(path, method = 'GET', body) {
  if (!KEY) throw new Error('ASAAS_API_KEY não configurada no .env.');
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: KEY,
      'User-Agent': 'OraculoDaAlma',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.errors && data.errors[0] ? data.errors[0].description : `Erro Asaas (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// Reaproveita o cliente pelo CPF/CNPJ; cria se não existir.
async function criarOuAcharCliente({ nome, cpf, whatsapp }) {
  const lista = await asaasReq('/customers?cpfCnpj=' + encodeURIComponent(cpf));
  if (lista && Array.isArray(lista.data) && lista.data.length) return lista.data[0].id;
  const novo = await asaasReq('/customers', 'POST', {
    name: nome,
    cpfCnpj: cpf,
    mobilePhone: whatsapp || undefined,
  });
  return novo.id;
}

// Cria a cobrança PIX e busca o QR Code + copia e cola.
async function criarCobrancaPix({ nome, cpf, whatsapp, valor, descricao, dueDate }) {
  const customerId = await criarOuAcharCliente({ nome, cpf, whatsapp });
  const pay = await asaasReq('/payments', 'POST', {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    dueDate,
    description: descricao,
  });
  const qr = await asaasReq('/payments/' + pay.id + '/pixQrCode');
  return {
    asaasId: pay.id,
    status: pay.status,
    value: pay.value,
    qrCodeImage: qr.encodedImage ? 'data:image/png;base64,' + qr.encodedImage : null,
    copiaECola: qr.payload || null,
  };
}

const APROVADO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const PENDENTE = ['PENDING', 'AWAITING_RISK_ANALYSIS'];

// Consulta o status atual de um pagamento Asaas.
async function consultarStatus(asaasId) {
  const pay = await asaasReq('/payments/' + asaasId);
  let status = 'falhou';
  if (APROVADO.includes(pay.status)) status = 'aprovado';
  else if (PENDENTE.includes(pay.status)) status = 'pendente';
  return { status, raw: pay.status, value: pay.value };
}

module.exports = { criarCobrancaPix, consultarStatus };

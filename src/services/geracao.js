// Geração do conteúdo da consulta (cálculo real + interpretação por IA).
// Compartilhado entre a esteira de pagamento e o painel admin.
const db = require('../config/database');
const { gerarMapaTecnico } = require('./astro');
const { tirarTarot, tirarBuzios } = require('./oraculos');
const ia = require('./openai');

async function gerarConteudo(consultation, user) {
  const input = consultation.input_json ? JSON.parse(consultation.input_json) : {};
  let technical = null;
  let texto = '';

  if (consultation.type === 'mapa_astral' || consultation.type === 'astrologia_vedica') {
    technical = gerarMapaTecnico({
      nome: input.nome || user.full_name,
      dataNascimento: input.dataNascimento,
      horaNascimento: input.horaNascimento,
      cidadeNascimento: input.cidadeNascimento,
      paisNascimento: input.paisNascimento,
      timezone: input.timezone,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    texto = await ia.interpretarMapa(technical);
  } else if (consultation.type === 'tarot') {
    const cartas = tirarTarot(3);
    technical = { tipo: 'tarot', cartas };
    texto = await ia.interpretarTarot(cartas, consultation.category || 'Conselho espiritual', user.full_name);
  } else if (consultation.type === 'buzios') {
    const jogada = tirarBuzios();
    technical = { tipo: 'buzios', jogada };
    texto = await ia.interpretarBuzios(jogada, consultation.category || 'Consulta geral', user.full_name);
  }

  db.prepare(`
    UPDATE consultations
    SET status = 'completed', result_text = ?, technical_json = ?
    WHERE id = ?
  `).run(texto, JSON.stringify(technical), consultation.id);

  return { texto, technical };
}

module.exports = { gerarConteudo };

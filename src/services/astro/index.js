// Orquestra os cálculos e monta o JSON técnico que será enviado à IA.
// Este JSON contém SOMENTE dados calculados por efemérides — a IA não inventa nada.
const { DateTime } = require('luxon');
const swiss = require('./swiss');
const { calcularOcidental } = require('./western');
const { calcularVedico } = require('./vedic');

/**
 * Gera o mapa técnico completo.
 *
 * @param {Object} dados
 * @param {string} dados.nome
 * @param {string} dados.dataNascimento  "AAAA-MM-DD"
 * @param {string} dados.horaNascimento  "HH:mm"
 * @param {string} dados.cidadeNascimento
 * @param {string} dados.paisNascimento
 * @param {string} dados.timezone   IANA, ex.: "America/Sao_Paulo"
 * @param {number} dados.latitude
 * @param {number} dados.longitude
 * @returns {Object} JSON técnico
 */
function gerarMapaTecnico(dados) {
  const {
    nome, dataNascimento, horaNascimento,
    cidadeNascimento, paisNascimento, timezone,
    latitude, longitude,
  } = dados;

  // Validações essenciais para um cálculo confiável.
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    throw new Error('dataNascimento deve estar no formato AAAA-MM-DD.');
  }
  if (!horaNascimento || !/^\d{2}:\d{2}$/.test(horaNascimento)) {
    throw new Error('horaNascimento é obrigatória (formato HH:mm) para calcular Ascendente e casas.');
  }
  if (!timezone) {
    throw new Error('timezone (IANA, ex.: America/Sao_Paulo) é obrigatório.');
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('latitude e longitude (números) são obrigatórias. Faça a geocodificação da cidade no frontend.');
  }

  const [year, month, day] = dataNascimento.split('-').map(Number);
  const [hour, minute] = horaNascimento.split(':').map(Number);

  // Instante astronômico (UT) e momento exato em UTC.
  const time = swiss.julianDayFromLocal({ year, month, day, hour, minute, timezone });
  const nascimentoUTC = DateTime.fromObject(
    { year, month, day, hour, minute }, { zone: timezone }
  ).toUTC().toJSDate();

  const ocidental = calcularOcidental(time, latitude, longitude);
  const vedico = calcularVedico(time, latitude, longitude, nascimentoUTC);

  // Formato final, alinhado ao exemplo solicitado (chaves em PT-BR).
  return {
    nome: nome || null,
    dataNascimento: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
    horaNascimento,
    cidadeNascimento: cidadeNascimento || null,
    paisNascimento: paisNascimento || null,
    fusoHorario: timezone,
    coordenadas: { latitude, longitude },
    diaJuliano: swiss.julianDay(time),

    astrologiaOcidental: {
      sol: ocidental.sol,
      lua: ocidental.lua,
      ascendente: ocidental.ascendente,
      meioDoCeu: ocidental.meioDoCeu,
      sistemaCasas: ocidental.sistemaCasas,
      casas: ocidental.casas,
      planetas: ocidental.planetas,
      aspectos: ocidental.aspectos,
      elementos: ocidental.elementos,
      modalidades: ocidental.modalidades,
    },

    astrologiaVedica: {
      solVedico: vedico.solVedico,
      luaVedica: vedico.luaVedica,
      ascendenteVedico: vedico.ascendenteVedico,
      lagna: vedico.lagna,
      nakshatra: vedico.nakshatra,
      pada: vedico.pada,
      senhorNakshatra: vedico.senhorNakshatra,
      rashi: vedico.rashi,
      ayanamsa: vedico.ayanamsa,
      grahas: vedico.grahas,
      dashas: vedico.dashas,
      dashaAtual: vedico.dashaAtual,
      periodoAtual: vedico.periodoAtual,
    },

    _meta: {
      motor: 'Swiss Ephemeris',
      observacao: 'Todos os valores acima são calculados por efemérides reais. A IA apenas interpreta.',
      geradoEm: new Date().toISOString(),
    },
  };
}

module.exports = { gerarMapaTecnico };

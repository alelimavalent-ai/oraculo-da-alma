// Monta o mapa VÉDICO (sideral, ayanamsa Lahiri): grahas, Nakshatra,
// Pada, Rashi, Lagna e a linha do tempo da Vimshottari Dasha.
const { DateTime } = require('luxon');
const swiss = require('./swiss');
const ref = require('./reference');

// Os 9 grahas clássicos. Ketu é Rahu + 180°.
const GRAHAS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'TrueNode'];

// Descobre Nakshatra (1–27), Pada (1–4) e Rashi de uma longitude sideral.
function nakshatraInfo(lonSideral) {
  const norm = ((lonSideral % 360) + 360) % 360;
  const idx = Math.floor(norm / ref.NAKSHATRA_ARC); // 0..26
  const dentro = norm - idx * ref.NAKSHATRA_ARC;
  const pada = Math.floor(dentro / ref.PADA_ARC) + 1; // 1..4
  return {
    nakshatra: ref.NAKSHATRAS[idx],
    nakshatraIndice: idx,
    pada,
    senhor: ref.NAKSHATRA_LORDS[idx],
    rashi: ref.signoDaLongitude(norm).signo,
  };
}

/**
 * Calcula a Vimshottari Dasha (Mahadashas) a partir da Lua sideral.
 * Retorna a linha do tempo completa (120 anos) com datas, marcando a atual.
 */
function vimshottariDasha(moonSideral, nascimentoUTC) {
  const norm = ((moonSideral % 360) + 360) % 360;
  const idxNak = Math.floor(norm / ref.NAKSHATRA_ARC);
  const senhorInicial = ref.NAKSHATRA_LORDS[idxNak];

  // Fração já percorrida da Nakshatra -> quanto resta do primeiro período.
  const dentro = norm - idxNak * ref.NAKSHATRA_ARC;
  const fracaoPercorrida = dentro / ref.NAKSHATRA_ARC;

  // Posição do senhor inicial na sequência Vimshottari.
  const startSeq = ref.VIMSHOTTARI.findIndex((d) => d.lord === senhorInicial);

  const DIAS_ANO = 365.2425;
  let cursor = DateTime.fromJSDate(nascimentoUTC, { zone: 'utc' });
  const linhaDoTempo = [];

  for (let n = 0; n < ref.VIMSHOTTARI.length; n++) {
    const item = ref.VIMSHOTTARI[(startSeq + n) % ref.VIMSHOTTARI.length];
    // O primeiro período entra apenas com o saldo restante.
    const anosEfetivos = n === 0 ? item.years * (1 - fracaoPercorrida) : item.years;
    const inicio = cursor;
    const fim = cursor.plus({ days: anosEfetivos * DIAS_ANO });
    linhaDoTempo.push({
      senhor: item.lord,
      anosTotais: item.years,
      anosNesteCiclo: Number(anosEfetivos.toFixed(2)),
      inicio: inicio.toISODate(),
      fim: fim.toISODate(),
    });
    cursor = fim;
  }

  // Marca qual Mahadasha está ativa agora.
  const agora = DateTime.utc();
  const atual = linhaDoTempo.find(
    (d) => DateTime.fromISO(d.inicio) <= agora && agora < DateTime.fromISO(d.fim)
  );

  return {
    senhorInicial,
    dashaAtual: atual ? atual.senhor : null,
    periodoAtual: atual || null,
    linhaDoTempo,
  };
}

/**
 * @param {number} jd  Dia Juliano (UT)
 * @param {number} lat
 * @param {number} lon
 * @param {Date}   nascimentoUTC  Momento exato do nascimento em UTC (para as dashas)
 */
function calcularVedico(jd, lat, lon, nascimentoUTC) {
  // Casas de signo inteiro ('W'), padrão da tradição védica, no sistema sideral.
  const casas = swiss.casas(jd, lat, lon, 'W', true);

  const grahas = GRAHAS.map((key) => {
    const pos = swiss.longitudePlaneta(jd, key, true);
    const s = ref.signoDaLongitude(pos.longitude);
    const nak = nakshatraInfo(pos.longitude);
    return {
      nome: ref.PLANETAS_PT[key] || key,
      longitude: Number(pos.longitude.toFixed(4)),
      rashi: s.signo,
      grau: s.grau,
      nakshatra: nak.nakshatra,
      pada: nak.pada,
      retrogrado: pos.retrogrado,
    };
  });

  // Acrescenta Ketu (oposto exato de Rahu/Nodo Norte).
  const rahu = grahas.find((g) => g.nome.startsWith('Nodo Norte'));
  if (rahu) {
    const ketuLon = (rahu.longitude + 180) % 360;
    const s = ref.signoDaLongitude(ketuLon);
    const nak = nakshatraInfo(ketuLon);
    grahas.push({
      nome: 'Nodo Sul (Ketu)',
      longitude: Number(ketuLon.toFixed(4)),
      rashi: s.signo,
      grau: s.grau,
      nakshatra: nak.nakshatra,
      pada: nak.pada,
      retrogrado: true,
    });
  }

  const sol = grahas.find((g) => g.nome === 'Sol');
  const lua = grahas.find((g) => g.nome === 'Lua');
  const luaInfo = nakshatraInfo(lua.longitude);
  const ascInfo = ref.signoDaLongitude(casas.ascendente);

  const dashas = vimshottariDasha(lua.longitude, nascimentoUTC);

  return {
    sistema: 'Sideral (védico) — ayanamsa Lahiri',
    sistemaCasas: 'Signo inteiro',
    ayanamsa: swiss.ayanamsa(jd),
    solVedico: sol.rashi,
    luaVedica: lua.rashi,
    ascendenteVedico: ascInfo.signo,
    lagna: ascInfo.signo, // Lagna = Ascendente sideral
    nakshatra: luaInfo.nakshatra,       // Nakshatra da Lua
    pada: luaInfo.pada,                 // Pada da Lua
    senhorNakshatra: luaInfo.senhor,
    rashi: lua.rashi,                   // Rashi da Lua (signo lunar)
    grahas,
    dashas: dashas.linhaDoTempo,
    dashaAtual: dashas.dashaAtual,
    periodoAtual: dashas.periodoAtual,
  };
}

module.exports = { calcularVedico, nakshatraInfo };

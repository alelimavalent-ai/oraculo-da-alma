// Monta o mapa astral OCIDENTAL (tropical) a partir do Dia Juliano e coordenadas.
const swiss = require('./swiss');
const ref = require('./reference');

// Planetas usados na carta ocidental (10 corpos + Nodo Norte).
const PLANETAS_OCIDENTAIS = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'TrueNode',
];

// Descobre em qual casa cai uma longitude, dadas as 12 cúspides.
function casaDaLongitude(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const inicio = cusps[i];
    const fim = cusps[(i + 1) % 12];
    // Trata a virada de 360°
    if (inicio <= fim) {
      if (lon >= inicio && lon < fim) return i + 1;
    } else {
      if (lon >= inicio || lon < fim) return i + 1;
    }
  }
  return 1;
}

// Calcula os aspectos maiores entre todos os pares de planetas.
function calcularAspectos(planetas) {
  const aspectos = [];
  for (let i = 0; i < planetas.length; i++) {
    for (let j = i + 1; j < planetas.length; j++) {
      let diff = Math.abs(planetas[i].longitude - planetas[j].longitude);
      if (diff > 180) diff = 360 - diff;
      for (const asp of ref.ASPECTOS) {
        const orbeReal = Math.abs(diff - asp.angulo);
        if (orbeReal <= asp.orbe) {
          aspectos.push({
            entre: [planetas[i].nome, planetas[j].nome],
            aspecto: asp.nome,
            anguloExato: asp.angulo,
            orbe: Number(orbeReal.toFixed(2)),
          });
          break;
        }
      }
    }
  }
  return aspectos;
}

/**
 * @param {number} jd  Dia Juliano (UT)
 * @param {number} lat
 * @param {number} lon
 */
function calcularOcidental(jd, lat, lon) {
  // Casas Placidus (padrão da astrologia ocidental)
  const casas = swiss.casas(jd, lat, lon, 'P', false);

  const planetas = PLANETAS_OCIDENTAIS.map((key) => {
    const pos = swiss.longitudePlaneta(jd, key, false);
    const s = ref.signoDaLongitude(pos.longitude);
    return {
      nome: ref.PLANETAS_PT[key] || key,
      longitude: Number(pos.longitude.toFixed(4)),
      signo: s.signo,
      grau: s.grau,
      elemento: s.elemento,
      modalidade: s.modalidade,
      retrogrado: pos.retrogrado,
      casa: casaDaLongitude(pos.longitude, casas.cusps),
    };
  });

  const sol = planetas.find((p) => p.nome === 'Sol');
  const lua = planetas.find((p) => p.nome === 'Lua');
  const ascSigno = ref.signoDaLongitude(casas.ascendente);
  const mcSigno = ref.signoDaLongitude(casas.meioDoCeu);

  // Contagem de elementos e modalidades (visão geral do temperamento)
  const contagemElementos = { Fogo: 0, Terra: 0, Ar: 0, Água: 0 };
  const contagemModalidades = { Cardinal: 0, Fixo: 0, Mutável: 0 };
  for (const p of planetas) {
    if (contagemElementos[p.elemento] != null) contagemElementos[p.elemento]++;
    if (contagemModalidades[p.modalidade] != null) contagemModalidades[p.modalidade]++;
  }

  return {
    sistema: 'Tropical (ocidental)',
    sistemaCasas: 'Signo inteiro (Whole Sign)',
    sol: sol.signo,
    lua: lua.signo,
    ascendente: ascSigno.signo,
    meioDoCeu: mcSigno.signo,
    casas: casas.cusps.map((c, i) => {
      const s = ref.signoDaLongitude(c);
      return { casa: i + 1, longitude: Number(c.toFixed(4)), signo: s.signo, grau: s.grau };
    }),
    planetas,
    aspectos: calcularAspectos(planetas),
    elementos: contagemElementos,
    modalidades: contagemModalidades,
  };
}

module.exports = { calcularOcidental };

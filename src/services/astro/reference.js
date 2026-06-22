// Constantes de referência usadas pelos cálculos astrológicos.
// Tudo em PT-BR para já sair pronto para o usuário.

// 12 signos na ordem do zodíaco (0 = Áries em 0°)
const SIGNOS = [
  'Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem',
  'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes',
];

// Elemento de cada signo
const ELEMENTOS = {
  'Áries': 'Fogo', 'Leão': 'Fogo', 'Sagitário': 'Fogo',
  'Touro': 'Terra', 'Virgem': 'Terra', 'Capricórnio': 'Terra',
  'Gêmeos': 'Ar', 'Libra': 'Ar', 'Aquário': 'Ar',
  'Câncer': 'Água', 'Escorpião': 'Água', 'Peixes': 'Água',
};

// Modalidade (qualidade) de cada signo
const MODALIDADES = {
  'Áries': 'Cardinal', 'Câncer': 'Cardinal', 'Libra': 'Cardinal', 'Capricórnio': 'Cardinal',
  'Touro': 'Fixo', 'Leão': 'Fixo', 'Escorpião': 'Fixo', 'Aquário': 'Fixo',
  'Gêmeos': 'Mutável', 'Virgem': 'Mutável', 'Sagitário': 'Mutável', 'Peixes': 'Mutável',
};

// 27 Nakshatras na ordem sideral (cada uma ocupa 13°20')
const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

// Sequência Vimshottari: senhores planetários e a duração (em anos) de cada Mahadasha.
// A ordem é fixa; o ponto de partida depende da Nakshatra da Lua.
const VIMSHOTTARI = [
  { lord: 'Ketu', years: 7 },
  { lord: 'Vênus', years: 20 },
  { lord: 'Sol', years: 6 },
  { lord: 'Lua', years: 10 },
  { lord: 'Marte', years: 7 },
  { lord: 'Rahu', years: 18 },
  { lord: 'Júpiter', years: 16 },
  { lord: 'Saturno', years: 19 },
  { lord: 'Mercúrio', years: 17 },
];
// Total = 120 anos.

// O senhor de cada Nakshatra segue o mesmo ciclo de 9, repetido 3 vezes.
const NAKSHATRA_LORDS = NAKSHATRAS.map((_, i) => VIMSHOTTARI[i % 9].lord);

// Nomes amigáveis dos planetas em PT-BR
const PLANETAS_PT = {
  Sun: 'Sol', Moon: 'Lua', Mercury: 'Mercúrio', Venus: 'Vênus', Mars: 'Marte',
  Jupiter: 'Júpiter', Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Netuno',
  Pluto: 'Plutão', TrueNode: 'Nodo Norte (Rahu)', SouthNode: 'Nodo Sul (Ketu)',
};

// Aspectos maiores e a tolerância (orbe) em graus
const ASPECTOS = [
  { nome: 'Conjunção', angulo: 0, orbe: 8 },
  { nome: 'Sextil', angulo: 60, orbe: 4 },
  { nome: 'Quadratura', angulo: 90, orbe: 6 },
  { nome: 'Trígono', angulo: 120, orbe: 6 },
  { nome: 'Oposição', angulo: 180, orbe: 8 },
];

const NAKSHATRA_ARC = 360 / 27; // 13.333... graus
const PADA_ARC = NAKSHATRA_ARC / 4; // 3.333... graus

// Converte uma longitude eclíptica (0–360) no índice e nome do signo.
function signoDaLongitude(lon) {
  const norm = ((lon % 360) + 360) % 360;
  const idx = Math.floor(norm / 30);
  const grauNoSigno = norm - idx * 30;
  return {
    indice: idx,
    signo: SIGNOS[idx],
    grau: Number(grauNoSigno.toFixed(4)),
    elemento: ELEMENTOS[SIGNOS[idx]],
    modalidade: MODALIDADES[SIGNOS[idx]],
  };
}

module.exports = {
  SIGNOS, ELEMENTOS, MODALIDADES, NAKSHATRAS, NAKSHATRA_LORDS,
  VIMSHOTTARI, PLANETAS_PT, ASPECTOS, NAKSHATRA_ARC, PADA_ARC,
  signoDaLongitude,
};

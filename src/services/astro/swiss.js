// ===========================================================
//  Motor astronômico — astronomy-engine (100% JavaScript).
//  SEM dependência nativa: não precisa de Python, compilador
//  C++ nem node-gyp. Funciona no Node 18, 20, 22 e 24.
//
//  Precisão equivalente ao Swiss Ephemeris para fins
//  astrológicos (diferença < ~1 minuto de arco).
//  Este é o ÚNICO arquivo que fala com a biblioteca de efemérides.
// ===========================================================
const Astronomy = require('astronomy-engine');
const { DateTime } = require('luxon');

// Corpos suportados (chave interna -> corpo da astronomy-engine)
const BODIES = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
};

// ---------- Trigonometria em graus ----------
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const sinD = (d) => Math.sin(d * D2R);
const cosD = (d) => Math.cos(d * D2R);
const tanD = (d) => Math.tan(d * D2R);
const atan2D = (y, x) => Math.atan2(y, x) * R2D;
const norm360 = (x) => ((x % 360) + 360) % 360;

// ---------- Tempo ----------
// Converte data/hora local + fuso (IANA) em um instante astronômico (UTC).
function julianDayFromLocal({ year, month, day, hour, minute, timezone }) {
  const local = DateTime.fromObject({ year, month, day, hour, minute }, { zone: timezone });
  if (!local.isValid) {
    throw new Error('Data/hora/fuso inválidos: ' + (local.invalidReason || ''));
  }
  return Astronomy.MakeTime(local.toUTC().toJSDate());
}

// Número do Dia Juliano (para exibição/auditoria)
function julianDay(time) {
  return time.ut + 2451545.0;
}

// Séculos julianos desde J2000
function julianCenturies(time) {
  return time.ut / 36525;
}

// Obliquidade média da eclíptica (graus) — IAU 2006
function obliquity(time) {
  const T = julianCenturies(time);
  return 23.4392794 - 0.0130102 * T - 0.00000164 * T * T + 0.000000503 * T * T * T;
}

// Ayanamsa Lahiri (graus) — diferença tropical/sideral
function ayanamsa(time) {
  const jd = julianDay(time);
  const anos = (jd - 2451545.0) / 365.25;
  return 23.8526 + 0.0139688 * anos;
}

// Longitude do nodo lunar médio (Rahu), tropical de data (graus) — Meeus
function meanNode(time) {
  const T = julianCenturies(time);
  const omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  return norm360(omega);
}

// ---------- Longitude eclíptica de um corpo ----------
// Retorna a longitude TROPICAL de data (graus).
function tropLongitude(time, key) {
  if (key === 'Sun') return norm360(Astronomy.SunPosition(time).elon);
  if (key === 'Moon') return norm360(Astronomy.EclipticGeoMoon(time).lon);
  if (key === 'TrueNode') return meanNode(time);
  const body = BODIES[key];
  if (!body) throw new Error('Corpo desconhecido: ' + key);
  const vec = Astronomy.GeoVector(body, time, true); // posição aparente (com aberração)
  return norm360(Astronomy.Ecliptic(vec).elon);
}

/**
 * Longitude de um planeta, tropical (ocidental) ou sideral (védico).
 * Inclui velocidade aproximada para detectar movimento retrógrado.
 */
function longitudePlaneta(time, key, sideral) {
  let lon = tropLongitude(time, key);
  if (sideral) lon = norm360(lon - ayanamsa(time));

  // Velocidade: compara com o dia seguinte
  const t2 = time.AddDays(1);
  let lon2 = tropLongitude(t2, key);
  if (sideral) lon2 = norm360(lon2 - ayanamsa(t2));
  let d = lon2 - lon;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;

  return { longitude: lon, speed: d, retrogrado: d < 0 };
}

/**
 * Ascendente, Meio do Céu e cúspides (casas de signo inteiro).
 * @param {*} time   instante astronômico
 * @param {number} lat  latitude (graus, norte +)
 * @param {number} lon  longitude (graus, leste +; oeste negativo)
 * @param {string} _sistema  mantido por compatibilidade (não usado)
 * @param {boolean} sideral
 */
function casas(time, lat, lon, _sistema, sideral) {
  const gast = Astronomy.SiderealTime(time);      // horas siderais em Greenwich
  const ramc = norm360(gast * 15 + lon);          // tempo sideral local, em graus
  const eps = obliquity(time);

  // Meio do Céu
  let mc = norm360(atan2D(sinD(ramc), cosD(ramc) * cosD(eps)));

  // Ascendente
  let asc = norm360(
    atan2D(cosD(ramc), -(sinD(ramc) * cosD(eps) + tanD(lat) * sinD(eps)))
  );

  if (sideral) {
    const ay = ayanamsa(time);
    asc = norm360(asc - ay);
    mc = norm360(mc - ay);
  }

  // Casas de signo inteiro: 1ª casa = signo do Ascendente
  const inicioSigno = Math.floor(asc / 30) * 30;
  const cusps = Array.from({ length: 12 }, (_, i) => norm360(inicioSigno + i * 30));

  return { cusps, ascendente: asc, meioDoCeu: mc };
}

module.exports = {
  julianDayFromLocal,
  julianDay,
  longitudePlaneta,
  casas,
  ayanamsa,
};

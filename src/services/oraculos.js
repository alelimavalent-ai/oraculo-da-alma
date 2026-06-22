// Sorteios feitos NO SERVIDOR (reproduzíveis e salvos), para Tarot e Búzios.
// A IA recebe o resultado do sorteio e apenas interpreta — não "inventa" cartas.
const crypto = require('crypto');

// Inteiro aleatório seguro em [0, max)
function randInt(max) {
  return crypto.randomInt(0, max);
}

// 22 Arcanos Maiores
const ARCANOS_MAIORES = [
  'O Louco', 'O Mago', 'A Sacerdotisa', 'A Imperatriz', 'O Imperador',
  'O Hierofante', 'Os Enamorados', 'O Carro', 'A Força', 'O Eremita',
  'A Roda da Fortuna', 'A Justiça', 'O Enforcado', 'A Morte', 'A Temperança',
  'O Diabo', 'A Torre', 'A Estrela', 'A Lua', 'O Sol',
  'O Julgamento', 'O Mundo',
];

// Arcanos Menores (naipes + valores)
const NAIPES = ['Paus', 'Copas', 'Espadas', 'Ouros'];
const VALORES = ['Ás', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete',
  'Oito', 'Nove', 'Dez', 'Valete', 'Cavaleiro', 'Rainha', 'Rei'];

function baralhoCompleto() {
  const cartas = [...ARCANOS_MAIORES];
  for (const naipe of NAIPES) {
    for (const valor of VALORES) {
      cartas.push(`${valor} de ${naipe}`);
    }
  }
  return cartas; // 78 cartas
}

// Embaralha e tira N cartas, cada uma com orientação (direita/invertida).
function tirarTarot(quantidade = 3) {
  const baralho = baralhoCompleto();
  // Fisher-Yates com aleatoriedade segura
  for (let i = baralho.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
  }
  const posicoes = ['Passado', 'Presente', 'Futuro', 'Conselho', 'Resultado'];
  return baralho.slice(0, quantidade).map((carta, i) => ({
    posicao: posicoes[i] || `Carta ${i + 1}`,
    carta,
    invertida: randInt(2) === 1,
  }));
}

// Búzios: 16 conchas, cada uma "boca" (aberta) ou "fechada".
// O número de bocas abertas define a "caída" (odu), base da leitura.
function tirarBuzios() {
  const conchas = Array.from({ length: 16 }, () => (randInt(2) === 1 ? 'aberta' : 'fechada'));
  const abertas = conchas.filter((c) => c === 'aberta').length;
  return {
    totalConchas: 16,
    abertas,
    fechadas: 16 - abertas,
    caida: `${abertas} aberta(s) / ${16 - abertas} fechada(s)`,
  };
}

module.exports = { tirarTarot, tirarBuzios, baralhoCompleto };

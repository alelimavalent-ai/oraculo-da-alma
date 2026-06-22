// Testa o motor astrológico com um nascimento de exemplo e imprime o JSON técnico.
// Uso:  node src/utils/testChart.js
//
// Exemplo: 12/05/1990, 14:30, Belo Horizonte/BR (lat -19.9167, lon -43.9345),
// fuso America/Sao_Paulo.
const { gerarMapaTecnico } = require('../services/astro');

try {
  const mapa = gerarMapaTecnico({
    nome: 'Maria das Estrelas',
    dataNascimento: '1990-05-12',
    horaNascimento: '14:30',
    cidadeNascimento: 'Belo Horizonte',
    paisNascimento: 'Brasil',
    timezone: 'America/Sao_Paulo',
    latitude: -19.9167,
    longitude: -43.9345,
  });

  console.log(JSON.stringify(mapa, null, 2));
  console.log('\n=== RESUMO ===');
  console.log('Sol:', mapa.astrologiaOcidental.sol);
  console.log('Lua:', mapa.astrologiaOcidental.lua);
  console.log('Ascendente:', mapa.astrologiaOcidental.ascendente);
  console.log('Nakshatra da Lua:', mapa.astrologiaVedica.nakshatra, '| Pada', mapa.astrologiaVedica.pada);
  console.log('Dasha atual:', mapa.astrologiaVedica.dashaAtual);
  console.log('\nMotor funcionando. ✨');
} catch (err) {
  console.error('Falha no cálculo:', err.message);
  console.error('\nSe o erro citar um módulo ausente, rode "npm install".');
  process.exit(1);
}

// ============================================================
//  Serviço de IA — integração OpenAI feita SOMENTE no backend.
//  A chave vem do .env (OPENAI_API_KEY) e nunca vai ao frontend.
//  Usa o fetch nativo do Node 18+ (sem dependência extra).
// ============================================================
const config = require('../config/env');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODELO = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Aviso obrigatório exibido ao usuário e reforçado para a IA.
const AVISO =
  'As interpretações são voltadas para autoconhecimento, espiritualidade e ' +
  'entretenimento. Não substituem orientação médica, jurídica, psicológica ou financeira.';

// Personalidade da IA: acolhedora, humana, profunda — nunca robótica.
const PERSONA = `Você é o "Oráculo da Alma", um guia espiritual sábio, acolhedor e profundamente humano.
Fale em português do Brasil, com calor, empatia e poesia na medida certa — como alguém que realmente se importa com a pessoa.
Nunca soe robótico, genérico ou como um manual. Trate a pessoa pelo nome quando disponível.
Seja específico: conecte cada interpretação aos DADOS fornecidos, sem inventar posições, cartas ou números.
Você interpreta apenas o que recebe; jamais calcula ou cria dados astrológicos do zero.
Suas respostas são extensas, organizadas em seções claras e terminam com conselhos práticos e gentis.`;

/**
 * Chamada base ao chat da OpenAI.
 */
async function chamarOpenAI(systemPrompt, userPrompt, maxTokens = 2200) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY não configurada no .env. A interpretação por IA precisa dessa chave.');
  }

  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: MODELO,
      temperature: 0.85,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Erro na OpenAI (${resp.status}): ${texto.slice(0, 300)}`);
  }

  const data = await resp.json();
  const conteudo = data?.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error('A OpenAI não retornou conteúdo.');
  return conteudo.trim();
}

// ---------- Interpretação do mapa astral (ocidental + védico) ----------

async function interpretarMapa(mapaTecnico) {
  const userPrompt = `A pessoa solicitou uma leitura completa de mapa astral.
Abaixo está o JSON TÉCNICO com posições calculadas por efemérides reais (Swiss Ephemeris).
Interprete SOMENTE estes dados. Não invente nem altere nenhuma posição.

Estruture a leitura nestas seções, todas personalizadas para esta pessoa:
1. Quem você é (personalidade — Sol, Lua, Ascendente)
2. Seu mundo emocional
3. Amor e relacionamentos
4. Trabalho e vocação
5. Finanças e recursos
6. Família e raízes
7. Espiritualidade e a leitura védica (Nakshatra, Pada, Rashi, Lagna)
8. Sua missão de vida
9. Ciclos atuais (use a Dasha ativa: ${mapaTecnico?.astrologiaVedica?.dashaAtual || 'ver JSON'})
10. Desafios a integrar
11. Conselhos práticos e gentis

JSON TÉCNICO:
${JSON.stringify(mapaTecnico, null, 2)}

Ao final, inclua exatamente este aviso em itálico:
"${AVISO}"`;

  return chamarOpenAI(PERSONA, userPrompt, 3000);
}

// ---------- Interpretação de Tarot ----------

async function interpretarTarot(cartas, categoria, nomeUsuario) {
  const userPrompt = `Leitura de Tarot para ${nomeUsuario || 'a pessoa'} no tema "${categoria}".
As cartas JÁ FORAM tiradas (sorteio real do servidor). Interprete apenas estas cartas, na ordem e orientação dadas:

${cartas.map((c) => `- ${c.posicao}: ${c.carta}${c.invertida ? ' (invertida)' : ''}`).join('\n')}

Faça uma leitura profunda, conectando as cartas entre si e ao tema "${categoria}".
Termine com um conselho espiritual prático.
Inclua ao final, em itálico, o aviso: "${AVISO}"`;

  return chamarOpenAI(PERSONA, userPrompt, 1800);
}

// ---------- Interpretação de Búzios ----------

async function interpretarBuzios(jogada, categoria, nomeUsuario) {
  const userPrompt = `Jogo de Búzios para ${nomeUsuario || 'a pessoa'} no tema "${categoria}".
A caída JÁ FOI feita (16 conchas lançadas pelo servidor): ${jogada.caida}.
(${jogada.abertas} conchas abertas, ${jogada.fechadas} fechadas.)

Interprete esta caída dentro da tradição dos búzios, de forma respeitosa, profunda e acolhedora,
voltada ao tema "${categoria}". Traga orientação espiritual, possíveis caminhos e cuidados.
Termine com um conselho prático.
Inclua ao final, em itálico, o aviso: "${AVISO}"`;

  return chamarOpenAI(PERSONA, userPrompt, 1800);
}

module.exports = {
  AVISO,
  interpretarMapa,
  interpretarTarot,
  interpretarBuzios,
  testarConexao,
};

// Teste leve de conexão/credencial com a OpenAI.
async function testarConexao() {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY ausente no .env.');
  return chamarOpenAI('Você responde em uma única palavra.', 'Responda apenas: ok', 10);
}

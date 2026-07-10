// Professora Alessandra — cérebro da IA (API da Claude)
const fs = require("fs");
const path = require("path");

const MODELO = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

function promptBase() {
  const arquivo = path.join(__dirname, "..", "prompt-professora-alessandra.txt");
  const conteudo = path.join(__dirname, "..", "conteudo-1serie.txt");
  let base = "Você é a Professora Alessandra, professora particular dos gêmeos Mateus e Lucas.";
  try { base = fs.readFileSync(arquivo, "utf-8"); } catch {}
  try { base += "\n\n" + fs.readFileSync(conteudo, "utf-8"); } catch {}
  return base;
}

// Monta o contexto individual do aluno (memória própria)
async function contextoAluno(prisma, aluno) {
  const [notas, dificuldades, materiais] = await Promise.all([
    prisma.nota.findMany({ where: { alunoId: aluno.id }, orderBy: { criadoEm: "desc" }, take: 40 }),
    prisma.dificuldade.findMany({ where: { alunoId: aluno.id }, orderBy: { criadoEm: "desc" }, take: 20 }),
    prisma.material.findMany({
      where: { OR: [{ alunoId: aluno.id }, { alunoId: null }] },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
  ]);

  let ctx = `\n\n=== FICHA DO ALUNO ===\nNome: ${aluno.nome}${aluno.apelido ? ` (chame de ${aluno.apelido})` : ""}\nIdade: ${aluno.idade} anos\nEscola: ${aluno.escola}${aluno.turma ? `\nTurma: ${aluno.turma}` : ""}${aluno.frequencia ? `\nFrequência: ${aluno.frequencia}` : ""}\n`;

  if (notas.length) {
    ctx += `\nBOLETIM (sistema de pontos do Colégio Elite: as avaliações do ano somam 100 pontos — P1=12, PM1=5, AD1=8, P2=12, PM2=5, AD2=8 no 1º semestre, ou seja, máximo de 50 pontos até agora; o 2º semestre completa os outros 50):\n`;
    for (const n of notas) ctx += `- ${n.materia}: ${n.nota} pontos acumulados (${n.bimestre}º sem/${n.ano})\n`;
    ctx += `Use esses pontos para priorizar as matérias mais fracas e calcular quanto o aluno ainda precisa para passar.\n`;
  }
  if (dificuldades.length) {
    ctx += `\nDIFICULDADES JÁ IDENTIFICADAS:\n`;
    for (const d of dificuldades) ctx += `- ${d.materia}: ${d.motivo}\n`;
  }
  if (materiais.length) {
    ctx += `\nLIVROS E MATERIAIS DO ALUNO (você DOMINA completamente o conteúdo de todos eles — currículo, capítulos e temas — e ensina com base neles com total segurança):\n`;
    for (const m of materiais) ctx += `- [${m.tipo}] ${m.titulo}${m.materia ? " — " + m.materia : ""}\n`;
  }
  ctx += `\nUse essas informações para personalizar o atendimento de ${aluno.apelido || aluno.nome}. Você conhece o currículo do ensino médio brasileiro e os materiais do Colégio Elite. Só peça foto quando precisar do ENUNCIADO EXATO de uma questão ou exercício específico.\n`;
  return ctx;
}

async function chamarClaude(mensagens, systemPrompt, comBusca = true) {
  const corpo = {
    model: MODELO,
    max_tokens: 3000,
    system: systemPrompt,
    messages: mensagens,
  };
  // Busca na internet: a professora pode pesquisar quando precisar
  if (comBusca) {
    corpo.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
  }
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const erro = await resp.text();
    // Se a busca na web não estiver disponível na conta, tenta de novo sem ela
    if (comBusca) return chamarClaude(mensagens, systemPrompt, false);
    throw new Error(`Erro na API da Claude: ${resp.status} - ${erro}`);
  }
  const data = await resp.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// Conversa principal
async function responder(prisma, { aluno, texto, materia, materialId, origem = "web" }) {
  // Histórico recente do aluno (memória da conversa)
  const historico = await prisma.mensagem.findMany({
    where: { alunoId: aluno.id },
    orderBy: { criadoEm: "desc" },
    take: 24,
  });
  historico.reverse();

  const mensagens = historico.map((m) => ({
    role: m.papel === "aluno" ? "user" : "assistant",
    content: m.texto,
  }));

  // Mensagem atual (com anexo, se tiver)
  const conteudo = [];
  if (materialId) {
    const mat = await prisma.material.findUnique({ where: { id: Number(materialId) } });
    if (mat && mat.arquivo) {
      const caminho = path.join(process.env.UPLOADS_DIR || "/app/uploads", mat.arquivo);
      if (fs.existsSync(caminho)) {
        const base64 = fs.readFileSync(caminho).toString("base64");
        if (mat.mime && mat.mime.startsWith("image/")) {
          conteudo.push({ type: "image", source: { type: "base64", media_type: mat.mime, data: base64 } });
        } else if (mat.mime === "application/pdf") {
          conteudo.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
        }
      }
    }
  }
  conteudo.push({ type: "text", text: materia ? `[Matéria: ${materia}] ${texto}` : texto });
  mensagens.push({ role: "user", content: conteudo });

  const system = promptBase() + (await contextoAluno(prisma, aluno));

  let resposta = await chamarClaude(mensagens, system);

  // Detecta marcador de dificuldade: [DIFICULDADE: matéria | motivo]
  const regex = /\[DIFICULDADE:\s*([^|\]]+)\|([^\]]+)\]/g;
  let m;
  const flags = [];
  while ((m = regex.exec(resposta)) !== null) {
    flags.push({ materia: m[1].trim(), motivo: m[2].trim() });
  }
  resposta = resposta.replace(regex, "").trim();

  // Salva mensagens
  await prisma.mensagem.create({
    data: { alunoId: aluno.id, papel: "aluno", texto, materia: materia || null, materialId: materialId ? Number(materialId) : null, origem },
  });
  await prisma.mensagem.create({
    data: { alunoId: aluno.id, papel: "alessandra", texto: resposta, materia: materia || null, origem },
  });

  // Salva dificuldades e cria alerta para o responsável se for recorrente
  for (const f of flags) {
    await prisma.dificuldade.create({ data: { alunoId: aluno.id, materia: f.materia, motivo: f.motivo } });
    const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentes = await prisma.dificuldade.count({
      where: { alunoId: aluno.id, materia: f.materia, criadoEm: { gte: desde } },
    });
    if (recentes >= 3) {
      const jaAvisado = await prisma.alerta.findFirst({
        where: { alunoId: aluno.id, materia: f.materia, criadoEm: { gte: desde } },
      });
      if (!jaAvisado) {
        await prisma.alerta.create({
          data: {
            alunoId: aluno.id,
            materia: f.materia,
            texto: `${aluno.nome} apresentou dificuldade recorrente em ${f.materia} nas últimas 2 semanas (${recentes} registros). Vale acompanhar de perto.`,
          },
        });
      }
    }
  }

  return resposta;
}

// Relatório simples para o responsável
async function gerarRelatorio(prisma, aluno) {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [totalMsgs, dificuldades, notas] = await Promise.all([
    prisma.mensagem.count({ where: { alunoId: aluno.id, papel: "aluno", criadoEm: { gte: desde } } }),
    prisma.dificuldade.findMany({ where: { alunoId: aluno.id, criadoEm: { gte: desde } } }),
    prisma.nota.findMany({ where: { alunoId: aluno.id }, orderBy: [{ ano: "desc" }, { bimestre: "desc" }] }),
  ]);

  const porMateria = {};
  for (const d of dificuldades) porMateria[d.materia] = (porMateria[d.materia] || 0) + 1;
  const ranking = Object.entries(porMateria).sort((a, b) => b[1] - a[1]);

  let rel = `RELATÓRIO — ${aluno.nome} (últimos 30 dias)\n\n`;
  rel += `Perguntas feitas à Professora Alessandra: ${totalMsgs}\n\n`;
  rel += ranking.length
    ? `Matérias com mais dificuldade:\n` + ranking.map(([mat, q]) => `- ${mat}: ${q} registro(s)`).join("\n") + "\n\n"
    : "Nenhuma dificuldade recorrente registrada no período.\n\n";
  if (notas.length) {
    rel += `Últimas notas:\n` + notas.slice(0, 10).map((n) => `- ${n.materia} (${n.bimestre}º bim/${n.ano}): ${n.nota}`).join("\n");
  }
  return rel;
}

module.exports = { responder, gerarRelatorio };

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { responder, gerarRelatorio } = require("./alessandra");

const fs = require("fs");
const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const UPLOADS = process.env.UPLOADS_DIR || "/app/uploads";
fs.mkdirSync(UPLOADS, { recursive: true });

// Frontend (build do React servido pelo próprio backend — 1 serviço só no Railway)
const PUBLICO = path.join(__dirname, "..", "public");
app.use(express.static(PUBLICO));

const JWT_SECRET = process.env.JWT_SECRET || "valentim-ia-secreto";

// ---------- Upload ----------
const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    const nome = crypto.randomBytes(8).toString("hex") + path.extname(file.originalname || "");
    cb(null, nome);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// ---------- Auth ----------
function autenticar(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Faça login novamente." });
  }
}

app.post("/api/login", async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await prisma.responsavel.findUnique({ where: { email: (email || "").toLowerCase().trim() } });
  if (!usuario || !bcrypt.compareSync(senha || "", usuario.senhaHash)) {
    return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  }
  const token = jwt.sign({ id: usuario.id, nome: usuario.nome, papel: usuario.papel, alunoId: usuario.alunoId }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, nome: usuario.nome, papel: usuario.papel, alunoId: usuario.alunoId });
});

app.post("/api/senha", autenticar, async (req, res) => {
  const { novaSenha } = req.body;
  if (!novaSenha || novaSenha.length < 6) return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });
  await prisma.responsavel.update({ where: { id: req.usuario.id }, data: { senhaHash: bcrypt.hashSync(novaSenha, 10) } });
  res.json({ ok: true });
});

// ---------- Alunos ----------
app.get("/api/alunos", autenticar, async (req, res) => {
  res.json(await prisma.aluno.findMany({ orderBy: { id: "asc" } }));
});

app.post("/api/alunos", autenticar, async (req, res) => {
  const { nome, idade, telefone } = req.body;
  res.json(await prisma.aluno.create({ data: { nome, idade: Number(idade) || 16, telefone: telefone || null } }));
});

app.put("/api/alunos/:id", autenticar, async (req, res) => {
  const { nome, idade, telefone } = req.body;
  res.json(
    await prisma.aluno.update({
      where: { id: Number(req.params.id) },
      data: { nome, idade: Number(idade) || 16, telefone: telefone || null },
    })
  );
});

// ---------- Matérias ----------
app.get("/api/materias", autenticar, async (req, res) => {
  res.json(await prisma.materia.findMany({ orderBy: { nome: "asc" } }));
});
app.post("/api/materias", autenticar, async (req, res) => {
  const nome = (req.body.nome || "").trim();
  if (!nome) return res.status(400).json({ erro: "Informe o nome da matéria." });
  res.json(await prisma.materia.upsert({ where: { nome }, create: { nome }, update: {} }));
});

// ---------- Materiais (livros, apostilas, boletins, fotos, PDFs) ----------
app.get("/api/materiais", autenticar, async (req, res) => {
  const alunoId = req.query.alunoId ? Number(req.query.alunoId) : undefined;
  res.json(
    await prisma.material.findMany({
      where: alunoId ? { OR: [{ alunoId }, { alunoId: null }] } : {},
      orderBy: { criadoEm: "desc" },
    })
  );
});

app.post("/api/materiais", autenticar, upload.single("arquivo"), async (req, res) => {
  const { titulo, tipo, materia, alunoId } = req.body;
  res.json(
    await prisma.material.create({
      data: {
        titulo: titulo || (req.file ? req.file.originalname : "Material"),
        tipo: tipo || "OUTRO",
        materia: materia || null,
        alunoId: alunoId ? Number(alunoId) : null,
        arquivo: req.file ? req.file.filename : null,
        mime: req.file ? req.file.mimetype : null,
      },
    })
  );
});

app.get("/api/materiais/:id/arquivo", autenticar, async (req, res) => {
  const mat = await prisma.material.findUnique({ where: { id: Number(req.params.id) } });
  if (!mat || !mat.arquivo) return res.status(404).end();
  res.sendFile(path.join(UPLOADS, mat.arquivo));
});

app.delete("/api/materiais/:id", autenticar, async (req, res) => {
  await prisma.material.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// ---------- Notas (boletim) ----------
app.get("/api/notas/:alunoId", autenticar, async (req, res) => {
  res.json(
    await prisma.nota.findMany({
      where: { alunoId: Number(req.params.alunoId) },
      orderBy: [{ ano: "desc" }, { bimestre: "desc" }, { materia: "asc" }],
    })
  );
});

app.post("/api/notas", autenticar, async (req, res) => {
  const { alunoId, materia, bimestre, ano, nota } = req.body;
  res.json(
    await prisma.nota.create({
      data: { alunoId: Number(alunoId), materia, bimestre: Number(bimestre), ano: Number(ano), nota: Number(nota) },
    })
  );
});

app.delete("/api/notas/:id", autenticar, async (req, res) => {
  await prisma.nota.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// ---------- Chat com a Professora Alessandra ----------
app.get("/api/chat/:alunoId", autenticar, async (req, res) => {
  res.json(
    await prisma.mensagem.findMany({
      where: { alunoId: Number(req.params.alunoId) },
      orderBy: { criadoEm: "asc" },
      take: 200,
    })
  );
});

app.post("/api/chat", autenticar, async (req, res) => {
  try {
    const { alunoId, texto, materia, materialId } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ erro: "Escreva uma mensagem." });
    const aluno = await prisma.aluno.findUnique({ where: { id: Number(alunoId) } });
    if (!aluno) return res.status(404).json({ erro: "Aluno não encontrado." });
    const resposta = await responder(prisma, { aluno, texto: texto.trim(), materia, materialId });
    res.json({ resposta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "A Professora Alessandra não conseguiu responder agora. Verifique a chave da API no arquivo .env e tente de novo." });
  }
});

// ---------- Painel (matérias mais difíceis) e alertas ----------
app.get("/api/painel/:alunoId", autenticar, async (req, res) => {
  const alunoId = Number(req.params.alunoId);
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [dificuldades, notas] = await Promise.all([
    prisma.dificuldade.findMany({ where: { alunoId, criadoEm: { gte: desde } } }),
    prisma.nota.findMany({ where: { alunoId } }),
  ]);
  const mapa = {};
  for (const d of dificuldades) {
    mapa[d.materia] = mapa[d.materia] || { materia: d.materia, registros: 0, motivos: [], media: null };
    mapa[d.materia].registros++;
    if (mapa[d.materia].motivos.length < 3) mapa[d.materia].motivos.push(d.motivo);
  }
  const somas = {};
  for (const n of notas) {
    somas[n.materia] = somas[n.materia] || { total: 0, qtd: 0 };
    somas[n.materia].total += n.nota;
    somas[n.materia].qtd++;
  }
  for (const mat of Object.keys(somas)) {
    const media = somas[mat].total / somas[mat].qtd;
    mapa[mat] = mapa[mat] || { materia: mat, registros: 0, motivos: [], media: null };
    mapa[mat].media = Math.round(media * 10) / 10;
  }
  const lista = Object.values(mapa).sort((a, b) => b.registros - a.registros || (a.media ?? 10) - (b.media ?? 10));
  res.json(lista);
});

app.get("/api/alertas", autenticar, async (req, res) => {
  res.json(
    await prisma.alerta.findMany({ where: { lido: false }, include: { aluno: true }, orderBy: { criadoEm: "desc" } })
  );
});
app.post("/api/alertas/:id/lido", autenticar, async (req, res) => {
  await prisma.alerta.update({ where: { id: Number(req.params.id) }, data: { lido: true } });
  res.json({ ok: true });
});

// ---------- Relatório ----------
app.get("/api/relatorio/:alunoId", autenticar, async (req, res) => {
  const aluno = await prisma.aluno.findUnique({ where: { id: Number(req.params.alunoId) } });
  if (!aluno) return res.status(404).json({ erro: "Aluno não encontrado." });
  res.json({ relatorio: await gerarRelatorio(prisma, aluno) });
});

// ---------- Configuração do WhatsApp (2 números — preparação futura) ----------
app.get("/api/config", autenticar, async (req, res) => {
  const configs = await prisma.config.findMany();
  const obj = {};
  for (const c of configs) obj[c.chave] = c.valor;
  res.json(obj);
});

app.post("/api/config", autenticar, async (req, res) => {
  for (const [chave, valor] of Object.entries(req.body || {})) {
    await prisma.config.upsert({ where: { chave }, create: { chave, valor: String(valor) }, update: { valor: String(valor) } });
  }
  res.json({ ok: true });
});

// Webhook futuro do WhatsApp (microserviço whatsmeow vai chamar aqui)
// Identifica o aluno pelo telefone e responde pela mesma inteligência do chat web.
app.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    const segredo = req.headers["x-whatsapp-secret"];
    if (segredo !== (process.env.WHATSAPP_SECRET || "trocar-este-segredo")) return res.status(401).end();
    const { telefone, texto, numeroDestino } = req.body; // numeroDestino: sala | particular
    const soDigitos = String(telefone || "").replace(/\D/g, "");
    const alunos = await prisma.aluno.findMany();
    const aluno = alunos.find((a) => a.telefone && soDigitos.endsWith(a.telefone.replace(/\D/g, "").slice(-8)));
    if (!aluno) return res.json({ resposta: "Oi! Eu sou a Professora Alessandra. Não reconheci esse número. Peça ao responsável para cadastrar seu telefone no sistema." });
    const origem = numeroDestino === "particular" ? "whatsapp_particular" : "whatsapp_sala";
    const resposta = await responder(prisma, { aluno, texto: String(texto || ""), origem });
    res.json({ resposta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro no webhook." });
  }
});

// Qualquer rota que não for /api devolve o app
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(PUBLICO, "index.html")));

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`Professora Alessandra no ar — porta ${PORTA}`));

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

// Pontos acumulados no 1º semestre de 2026 (máximo até agora: 50 de 100 pontos anuais)
const NOTAS_MATEUS = {
  "Arte": 27.2, "Biologia": 30.5, "Educação Física": 36.9, "Filosofia": 34.2,
  "Física": 24.8, "Geografia": 31.2, "História": 25.6, "Leitura e Prática Textual": 28.4,
  "Língua Inglesa": 28.8, "Língua Portuguesa": 24.6, "Literatura": 20, "Matemática": 24.5,
  "Química": 30.3, "Sociologia": 29.1, "Transformações Químicas": 30.3,
};
const NOTAS_LUCAS = {
  "Arte": 24.3, "Biologia": 27, "Educação Física": 33.3, "Filosofia": 32.9,
  "Física": 18.7, "Geografia": 20.9, "História": 28.4, "Leitura e Prática Textual": 33.3,
  "Língua Inglesa": 23.5, "Língua Portuguesa": 22.4, "Literatura": 13.8, "Matemática": 23.6,
  "Química": 20.4, "Sociologia": 29.3, "Transformações Químicas": 20.4,
};

async function main() {
  await prisma.responsavel.upsert({
    where: { email: "valentim@valentimia.com" },
    create: { nome: "Valentim", email: "valentim@valentimia.com", senhaHash: bcrypt.hashSync("valentim123", 10), papel: "responsavel" },
    update: {},
  });
  await prisma.responsavel.upsert({
    where: { email: "lene@valentimia.com" },
    create: { nome: "Lene", email: "lene@valentimia.com", senhaHash: bcrypt.hashSync("lene123", 10), papel: "responsavel" },
    update: {},
  });

  const total = await prisma.aluno.count();
  if (total === 0) {
    const mateus = await prisma.aluno.create({
      data: {
        nome: "Mateus Silva de Lima", apelido: "Mateus", idade: 16,
        escola: "Colégio Elite RJ — Norte Shopping", turma: "1ª série A - M",
        matricula: "25408822", frequencia: "85,1%",
      },
    });
    const lucas = await prisma.aluno.create({
      data: {
        nome: "Lucas Silva de Lima", apelido: "Lucas", idade: 16,
        escola: "Colégio Elite RJ — Norte Shopping", turma: "1ª série A - M",
        matricula: "25408825", frequencia: "83%",
      },
    });

    for (const [materia, nota] of Object.entries(NOTAS_MATEUS)) {
      await prisma.nota.create({ data: { alunoId: mateus.id, materia, bimestre: 1, ano: 2026, nota } });
    }
    for (const [materia, nota] of Object.entries(NOTAS_LUCAS)) {
      await prisma.nota.create({ data: { alunoId: lucas.id, materia, bimestre: 1, ano: 2026, nota } });
    }
    console.log("Boletins do Colégio Elite cadastrados para Mateus e Lucas.");

    // Logins dos alunos (cada um entra direto no chat só do seu material)
    await prisma.responsavel.upsert({
      where: { email: "mateus@valentimia.com" },
      create: { nome: "Mateus", email: "mateus@valentimia.com", senhaHash: bcrypt.hashSync("mateus123", 10), papel: "aluno", alunoId: mateus.id },
      update: {},
    });
    await prisma.responsavel.upsert({
      where: { email: "lucas@valentimia.com" },
      create: { nome: "Lucas", email: "lucas@valentimia.com", senhaHash: bcrypt.hashSync("lucas123", 10), papel: "aluno", alunoId: lucas.id },
      update: {},
    });
    console.log("Logins criados: Valentim e Lene (responsáveis), Mateus e Lucas (alunos).");
  }

  const materias = Object.keys(NOTAS_MATEUS).concat(["Redação", "Projeto de Vida"]);
  for (const nome of materias) {
    await prisma.materia.upsert({ where: { nome }, create: { nome }, update: {} });
  }

  // Livros-base oficiais — sistema Somos Educação / Amplia (valem para os dois gêmeos)
  const LIVROS = [
    { titulo: "Amplia — Inglês, Livro 1 (Somos Educação)", materia: "Língua Inglesa" },
    { titulo: "Amplia — Arte, Livro 1 (Somos Educação)", materia: "Arte" },
    { titulo: "Amplia — Linguagens e Ciências Humanas, Livro 1 (Português, Literatura, Redação, História, Geografia, Filosofia e Sociologia — Somos Educação)", materia: "Linguagens e Ciências Humanas" },
    { titulo: "Amplia — Matemática e Ciências da Natureza, Livro 2 (Matemática, Física, Química e Biologia — Somos Educação)", materia: "Matemática e Ciências da Natureza" },
    { titulo: "Amplia — Filosofia, Livro 1 (Somos Educação)", materia: "Filosofia" },
    { titulo: "Amplia — Projeto de Vida, 1º ano do Ensino Médio (Somos Educação)", materia: "Projeto de Vida" },
  ];
  for (const l of LIVROS) {
    const existe = await prisma.material.findFirst({ where: { titulo: l.titulo } });
    if (!existe) await prisma.material.create({ data: { titulo: l.titulo, tipo: "LIVRO", materia: l.materia, alunoId: null } });
  }
  console.log("Livros Amplia (Somos Educação) cadastrados como base oficial.");

  console.log("Banco pronto.");
}

main().finally(() => prisma.$disconnect());

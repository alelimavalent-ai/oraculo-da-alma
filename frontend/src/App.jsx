import React, { useEffect, useRef, useState } from "react";

const api = async (rota, opcoes = {}) => {
  const token = localStorage.getItem("token");
  const resp = await fetch("/api" + rota, {
    ...opcoes,
    headers: {
      ...(opcoes.body && !(opcoes.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opcoes.headers || {}),
    },
  });
  if (resp.status === 401) {
    localStorage.removeItem("token");
    window.location.reload();
  }
  return resp.json();
};


function TextoMsg({ texto }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.mermaid) {
      const nos = ref.current.querySelectorAll(".mermaid:not([data-processed])");
      if (nos.length) window.mermaid.run({ nodes: nos }).catch(() => {});
    }
  }, [texto]);
  const partes = String(texto).split(/```mermaid([\s\S]*?)```/g);
  return (
    <div ref={ref}>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <div key={i} className="mermaid mapa-visual">{p.trim()}</div>
        ) : (
          p.split(/(\*\*[^*]+\*\*)/g).map((t, j) =>
            t.startsWith("**") && t.endsWith("**") ? <strong key={i + "-" + j}>{t.slice(2, -2)}</strong> : <span key={i + "-" + j}>{t}</span>
          )
        )
      )}
    </div>
  );
}

function Marca() {
  return (
    <div className="topo">
      <img className="avatar" src="/alessandra-rosto.jpg" alt="Professora Alessandra" />
      <div>
        <h1 className="marca"><span className="v">V</span>ALENTIM IA</h1>
        <small>PROFESSORA ALESSANDRA — SALA DE ESTUDOS</small>
      </div>
    </div>
  );
}

function Login({ aoEntrar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async () => {
    setCarregando(true);
    setErro("");
    const r = await api("/login", { method: "POST", body: JSON.stringify({ email, senha }) });
    setCarregando(false);
    if (r.token) {
      localStorage.setItem("token", r.token);
      localStorage.setItem("papel", r.papel || "responsavel");
      localStorage.setItem("alunoId", r.alunoId || "");
      aoEntrar();
    } else setErro(r.erro || "Não foi possível entrar.");
  };

  return (
    <div className="login-tela">
      <div className="card">
        <img className="foto-destaque" src="/alessandra.jpg" alt="Professora Alessandra" />
        <h1 className="marca" style={{ fontSize: 22 }}><span className="v">V</span>ALENTIM IA</h1>
        <p style={{ color: "var(--aco)", fontSize: 12, letterSpacing: 2, margin: "6px 0 18px" }}>PROFESSORA ALESSANDRA</p>
        {erro && <p className="erro">{erro}</p>}
        <input placeholder="E-mail do responsável" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} />
        <button className="btn" onClick={entrar} disabled={carregando}>{carregando ? "Entrando..." : "Entrar"}</button>
      </div>
    </div>
  );
}

function SeletorAluno({ alunos, alunoId, setAlunoId }) {
  return (
    <div className="sel-aluno">
      {alunos.map((a) => (
        <button key={a.id} className={alunoId === a.id ? "ativa" : ""} onClick={() => setAlunoId(a.id)}>{a.apelido || a.nome}</button>
      ))}
    </div>
  );
}

function Chat({ aluno, materias }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [materia, setMateria] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef(null);
  const arquivoRef = useRef(null);

  const carregar = async () => setMensagens(await api("/chat/" + aluno.id));
  useEffect(() => { carregar(); }, [aluno.id]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens]);

  const enviar = async (materialId) => {
    if (!texto.trim() && !materialId) return;
    const t = texto.trim() || "Dá uma olhada nesse material, por favor.";
    setEnviando(true);
    setMensagens((m) => [...m, { id: "tmp", papel: "aluno", texto: t }]);
    setTexto("");
    await api("/chat", { method: "POST", body: JSON.stringify({ alunoId: aluno.id, texto: t, materia: materia || undefined, materialId }) });
    await carregar();
    setEnviando(false);
  };

  const anexar = async (e) => {
    const arq = e.target.files[0];
    if (!arq) return;
    const fd = new FormData();
    fd.append("arquivo", arq);
    fd.append("titulo", "Foto enviada no chat — " + (aluno.apelido || aluno.nome));
    fd.append("tipo", "FOTO");
    fd.append("alunoId", aluno.id);
    if (materia) fd.append("materia", materia);
    const mat = await api("/materiais", { method: "POST", body: fd });
    e.target.value = "";
    await enviar(mat.id);
  };

  return (
    <div className="card">
      <img className="foto-destaque" src="/alessandra.jpg" alt="Professora Alessandra na sala de estudos" />
      <p className="legenda-foto">PROFESSORA ALESSANDRA · EXPERT EM TODAS AS MATÉRIAS DO ELITE</p>
      <h2>Chat — {aluno.apelido || aluno.nome}</h2>
      <select value={materia} onChange={(e) => setMateria(e.target.value)}>
        <option value="">Qual matéria? (opcional)</option>
        {materias.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
      </select>
      <div className="chat-caixa">
        {mensagens.length === 0 && <p style={{ color: "var(--aco)", fontSize: 14 }}>Oi, {aluno.apelido || aluno.nome}! Eu sou a Professora Alessandra. Me conta qual matéria você está estudando e qual é a sua dúvida. Já conheço seu boletim do Elite e seus livros. 💙</p>}
        {mensagens.map((m, i) => <div key={m.id || i} className={"msg " + m.papel}><TextoMsg texto={m.texto} /></div>)}
        {enviando && <div className="msg alessandra">Digitando...</div>}
        <div ref={fim} />
      </div>
      <div className="chat-envio">
        <button className="btn-2" onClick={() => arquivoRef.current.click()} title="Enviar foto da página">📷</button>
        <input type="file" ref={arquivoRef} style={{ display: "none" }} accept="image/*,application/pdf" onChange={anexar} />
        <textarea placeholder="Escreva a dúvida aqui..." value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <button className="btn" onClick={() => enviar()} disabled={enviando}>➤</button>
      </div>
    </div>
  );
}

function Painel({ aluno }) {
  const [itens, setItens] = useState([]);
  const [relatorio, setRelatorio] = useState("");
  useEffect(() => { api("/painel/" + aluno.id).then(setItens); setRelatorio(""); }, [aluno.id]);
  const max = Math.max(1, ...itens.map((i) => i.registros));
  return (
    <>
      <div className="card">
        <h2>Matérias mais difíceis — {aluno.apelido || aluno.nome}</h2>
        {itens.length === 0 && <p style={{ color: "var(--aco)", fontSize: 14 }}>Ainda não há registros. Conforme {aluno.apelido || aluno.nome} conversar com a professora, as dificuldades aparecem aqui.</p>}
        {itens.map((i) => (
          <div key={i.materia} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <strong>{i.materia}</strong>
              <span style={{ color: "var(--aco)" }}>{i.registros} dificuldade(s){i.media != null ? ` · média ${i.media}` : ""}</span>
            </div>
            <div className="barra"><div style={{ width: (i.registros / max) * 100 + "%" }} /></div>
            {i.motivos.length > 0 && <p style={{ fontSize: 12, color: "var(--prata2)", marginTop: 4 }}>{i.motivos.join(" · ")}</p>}
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Relatório para o responsável</h2>
        {relatorio ? <pre className="relatorio">{relatorio}</pre> :
          <button className="btn-2" onClick={async () => setRelatorio((await api("/relatorio/" + aluno.id)).relatorio)}>Gerar relatório dos últimos 30 dias</button>}
      </div>
    </>
  );
}

function Materiais({ alunos, materias }) {
  const [lista, setLista] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("LIVRO");
  const [materia, setMateria] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api("/materiais").then(setLista);
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!titulo.trim()) return;
    setSalvando(true);
    const fd = new FormData();
    fd.append("titulo", titulo);
    fd.append("tipo", tipo);
    if (materia) fd.append("materia", materia);
    if (alunoId) fd.append("alunoId", alunoId);
    if (arquivo) fd.append("arquivo", arquivo);
    await api("/materiais", { method: "POST", body: fd });
    setTitulo(""); setArquivo(null); setSalvando(false);
    carregar();
  };

  return (
    <>
      <div className="card">
        <h2>Cadastrar livro ou apostila (só o nome já basta)</h2>
        <input placeholder="Nome do livro (ex: Apostila Elite Matemática — 1ª série, vol. 2)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <div className="grade2">
          <div>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="LIVRO">Livro</option>
              <option value="APOSTILA">Apostila</option>
              <option value="BOLETIM">Boletim</option>
              <option value="PROVA">Prova</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label>Matéria</label>
            <select value={materia} onChange={(e) => setMateria(e.target.value)}>
              <option value="">—</option>
              {materias.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
          </div>
        </div>
        <label>Aluno (deixe em branco se for dos dois)</label>
        <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
          <option value="">Mateus e Lucas</option>
          {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <label>Foto ou PDF — OPCIONAL (a professora já domina o conteúdo pelo nome)</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files[0])} />
        <button className="btn" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar material"}</button>
      </div>
      <div className="card">
        <h2>Materiais cadastrados</h2>
        {lista.length === 0 && <p style={{ color: "var(--aco)", fontSize: 14 }}>Nenhum material ainda.</p>}
        {lista.map((m) => (
          <div key={m.id} className="lista-item">
            <span>{m.titulo}{m.materia ? <span style={{ color: "var(--aco)" }}> — {m.materia}</span> : null}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="tag">{m.tipo}</span>
              <button className="btn-2" onClick={async () => { await api("/materiais/" + m.id, { method: "DELETE" }); carregar(); }}>✕</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Boletim({ aluno, materias }) {
  const [notas, setNotas] = useState([]);
  const [f, setF] = useState({ materia: "", bimestre: 1, ano: new Date().getFullYear(), nota: "" });
  const carregar = () => api("/notas/" + aluno.id).then(setNotas);
  useEffect(() => { carregar(); }, [aluno.id]);

  const salvar = async () => {
    if (!f.materia || f.nota === "") return;
    await api("/notas", { method: "POST", body: JSON.stringify({ ...f, alunoId: aluno.id }) });
    setF({ ...f, nota: "" });
    carregar();
  };

  return (
    <>
      <div className="card">
        <h2>Lançar pontos — {aluno.apelido || aluno.nome}</h2>
        <div className="grade2">
          <div>
            <label>Matéria</label>
            <select value={f.materia} onChange={(e) => setF({ ...f, materia: e.target.value })}>
              <option value="">—</option>
              {materias.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label>Bimestre</label>
            <select value={f.bimestre} onChange={(e) => setF({ ...f, bimestre: e.target.value })}>
              {[1, 2, 3, 4].map((b) => <option key={b} value={b}>{b}º</option>)}
            </select>
          </div>
          <div>
            <label>Ano</label>
            <input type="number" value={f.ano} onChange={(e) => setF({ ...f, ano: e.target.value })} />
          </div>
          <div>
            <label>Nota</label>
            <input type="number" step="0.1" placeholder="pontos" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          </div>
        </div>
        <button className="btn" onClick={salvar}>Salvar nota</button>
      </div>
      <div className="card">
        <h2>Boletim de {aluno.apelido || aluno.nome} — Colégio Elite (pontos de 100 no ano)</h2>
        {notas.length === 0 && <p style={{ color: "var(--aco)", fontSize: 14 }}>Nenhuma nota lançada.</p>}
        {notas.map((n) => (
          <div key={n.id} className="lista-item">
            <span>{n.materia} — {n.bimestre}º bim/{n.ano}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="tag" style={n.nota < 6 ? { color: "#ff9d7a", borderColor: "rgba(255,120,80,.4)" } : {}}>{n.nota}</span>
              <button className="btn-2" onClick={async () => { await api("/notas/" + n.id, { method: "DELETE" }); carregar(); }}>✕</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Config({ alunos, recarregarAlunos }) {
  const [cfg, setCfg] = useState({});
  const [als, setAls] = useState([]);
  const [msg, setMsg] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  useEffect(() => { api("/config").then(setCfg); setAls(alunos.map((a) => ({ ...a }))); }, [alunos]);

  const salvar = async () => {
    await api("/config", { method: "POST", body: JSON.stringify(cfg) });
    for (const a of als) await api("/alunos/" + a.id, { method: "PUT", body: JSON.stringify(a) });
    if (novaSenha) { await api("/senha", { method: "POST", body: JSON.stringify({ novaSenha }) }); setNovaSenha(""); }
    recarregarAlunos();
    setMsg("Salvo com sucesso!");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="card">
      <h2>Configurações</h2>
      {msg && <p className="ok">{msg}</p>}
      <label>Número do WhatsApp — Sala de estudos (futuro)</label>
      <input placeholder="Ex: 5521999999999" value={cfg.numeroSala || ""} onChange={(e) => setCfg({ ...cfg, numeroSala: e.target.value })} />
      <label>Número do WhatsApp — Particular (futuro)</label>
      <input placeholder="Ex: 5521888888888" value={cfg.numeroParticular || ""} onChange={(e) => setCfg({ ...cfg, numeroParticular: e.target.value })} />
      {als.map((a, i) => (
        <div key={a.id}>
          <label>Telefone de {a.nome} (para a Alessandra reconhecer no WhatsApp)</label>
          <input placeholder="Ex: 5521977777777" value={a.telefone || ""} onChange={(e) => { const c = [...als]; c[i].telefone = e.target.value; setAls(c); }} />
        </div>
      ))}
      <label>Trocar senha do responsável (opcional)</label>
      <input type="password" placeholder="Nova senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
      <button className="btn" onClick={salvar}>Salvar configurações</button>
    </div>
  );
}

export default function App() {
  const [logado, setLogado] = useState(!!localStorage.getItem("token"));
  const [alunos, setAlunos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [alunoId, setAlunoId] = useState(null);
  const [aba, setAba] = useState("chat");
  const [alertas, setAlertas] = useState([]);

  const papel = localStorage.getItem("papel") || "responsavel";
  const meuAlunoId = localStorage.getItem("alunoId");
  const ehAluno = papel === "aluno";

  const recarregarAlunos = () => api("/alunos").then((a) => {
    // Se for aluno, mostra só ele mesmo
    const lista = ehAluno && meuAlunoId ? a.filter((x) => String(x.id) === String(meuAlunoId)) : a;
    setAlunos(lista);
    if (lista[0]) setAlunoId(lista[0].id);
  });

  useEffect(() => {
    if (!logado) return;
    recarregarAlunos();
    api("/materias").then(setMaterias);
    if (!ehAluno) api("/alertas").then(setAlertas);
  }, [logado]);

  if (!logado) return <Login aoEntrar={() => setLogado(true)} />;
  const aluno = alunos.find((a) => a.id === alunoId);

  // Abas: aluno só tem Chat; responsável tem tudo
  const abasResponsavel = [["chat", "💬 Chat"], ["painel", "📊 Painel"], ["boletim", "📋 Boletim"], ["materiais", "📚 Materiais"], ["config", "⚙️ Config"]];
  const abasAluno = [["chat", "💬 Chat"], ["boletim", "📋 Minhas notas"]];
  const abasVisiveis = ehAluno ? abasAluno : abasResponsavel;

  return (
    <>
      <Marca />
      <div className="container">
        {!ehAluno && alertas.map((al) => (
          <div key={al.id} className="alerta">
            ⚠️ <strong>{al.aluno?.nome}</strong>: {al.texto}
            <div style={{ marginTop: 8 }}>
              <button className="btn-2" onClick={async () => { await api("/alertas/" + al.id + "/lido", { method: "POST" }); setAlertas(alertas.filter((x) => x.id !== al.id)); }}>Ok, entendi</button>
            </div>
          </div>
        ))}
        {!ehAluno && <SeletorAluno alunos={alunos} alunoId={alunoId} setAlunoId={setAlunoId} />}
        <div className="abas">
          {abasVisiveis.map(([k, r]) => (
            <button key={k} className={aba === k ? "ativa" : ""} onClick={() => setAba(k)}>{r}</button>
          ))}
          <button onClick={() => { localStorage.clear(); setLogado(false); }}>Sair</button>
        </div>
        {aluno && aba === "chat" && <Chat aluno={aluno} materias={materias} />}
        {!ehAluno && aluno && aba === "painel" && <Painel aluno={aluno} />}
        {aluno && aba === "boletim" && <Boletim aluno={aluno} materias={materias} />}
        {!ehAluno && aba === "materiais" && <Materiais alunos={alunos} materias={materias} />}
        {!ehAluno && aba === "config" && <Config alunos={alunos} recarregarAlunos={recarregarAlunos} />}
      </div>
      <p className="rodape">VALENTIM IA · PROFESSORA ALESSANDRA · v1</p>
    </>
  );
}

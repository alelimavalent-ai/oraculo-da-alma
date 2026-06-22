# ✨ Oráculo da Alma

> O universo fala com você.

Plataforma de consultas espirituais e autoconhecimento com IA.
Este repositório contém a **Etapa 1 — Fundação**: backend, banco de dados persistente e autenticação completa.

## O que já funciona nesta etapa

- Cadastro com todos os campos (nome, nascimento, hora, cidade, nome da mãe, e-mail, telefone, senha)
- Senha criptografada com bcrypt (nunca salva em texto puro)
- Login com token JWT
- Ver dados do usuário logado
- Alteração de senha
- Recuperação de senha por token (envio de e-mail entra numa próxima etapa)
- Logout
- Bloqueio de conta e papel de administrador já previstos no banco
- Banco SQLite **persistente** — nada se perde ao reiniciar

## Banco de dados — sql.js (sem compilação)

O banco usa **sql.js** (SQLite compilado para WebAssembly): 100% JavaScript/WASM.
**Não precisa de Visual Studio, compilador C++, Python nem node-gyp.** Os dados
são salvos em arquivo (`./data/oraculo.db`) a cada gravação — nada se perde ao reiniciar.

Nenhuma dependência do projeto exige compilação nativa. No Windows, basta:

```
install.bat
```
ou, manualmente, `npm install` e `npm start`.

## Pré-requisitos

- Node.js 18 ou superior (`node --version` para conferir)

## Como rodar

```bash
# 1. Instalar as dependências
npm install

# 2. Criar o arquivo de configuração
cp .env.example .env
#   (no Windows: copy .env.example .env)
#   Depois abra o .env e defina um JWT_SECRET bem aleatório.

# 3. Iniciar o servidor
npm start
```

O servidor sobe em `http://localhost:3000`.
O banco é criado automaticamente em `./data/oraculo.db`.

## Criar um administrador

```bash
node src/utils/createAdmin.js admin@oraculo.com MinhaSenhaForte123
```

## Testando a API

Com o servidor rodando, em outro terminal:

```bash
# Saúde do servidor
curl http://localhost:3000/api/health

# Cadastro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Maria das Estrelas",
    "birth_date": "1990-05-12",
    "birth_time": "14:30",
    "birth_city": "Belo Horizonte",
    "mother_name": "Ana",
    "email": "maria@exemplo.com",
    "phone": "31999998888",
    "password": "senha123"
  }'

# Login (guarde o token que volta)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@exemplo.com","password":"senha123"}'

# Dados do usuário logado (troque SEU_TOKEN)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN"
```

## Endpoints disponíveis

| Método | Rota | Protegida | Descrição |
|--------|------|-----------|-----------|
| GET  | `/api/health` | não | Status do servidor |
| POST | `/api/auth/register` | não | Cadastro |
| POST | `/api/auth/login` | não | Login |
| POST | `/api/auth/forgot-password` | não | Solicitar redefinição |
| POST | `/api/auth/reset-password` | não | Confirmar nova senha com token |
| GET  | `/api/auth/me` | sim | Dados do usuário logado |
| POST | `/api/auth/change-password` | sim | Trocar senha |
| POST | `/api/auth/logout` | sim | Encerrar sessão |

## Estrutura do projeto

```
oraculo-da-alma/
├── server.js              # ponto de entrada
├── package.json
├── .env.example           # modelo de configuração
├── data/                  # banco SQLite (criado automaticamente)
└── src/
    ├── config/
    │   ├── env.js         # lê o .env
    │   └── database.js    # conexão + schema
    ├── controllers/
    │   └── authController.js
    ├── middleware/
    │   └── auth.js
    ├── routes/
    │   └── auth.js
    └── utils/
        └── createAdmin.js
```

## Pagamento PIX com Asaas (NOVO)

Cobrança real via **Asaas**. A chave fica só no `.env` (`ASAAS_API_KEY`).

**Fluxo do cliente:**
1. Escolhe a consulta → tela de pagamento.
2. Informa **nome, CPF e WhatsApp** (o Asaas exige CPF/CNPJ para a cobrança).
3. Sistema gera a cobrança PIX no Asaas e exibe **QR Code** + **PIX copia e cola**.
4. O app **consulta o status automaticamente** (a cada 5s).
5. Quando aprovado, a consulta é liberada, gerada (cálculo real + IA) e o **PDF** fica disponível.
6. Cliente, valor, data e status ficam salvos.

Nenhuma consulta é liberada sem pagamento aprovado (admin continua grátis/ilimitado).

**Configuração no `.env`:**
```
ASAAS_API_KEY=sua_chave_asaas
ASAAS_BASE_URL=https://api.asaas.com/v3   # produção (sandbox: https://sandbox.asaas.com/api/v3)
```

**Rotas:** `POST /api/payments/pix` (gera cobrança) e `GET /api/payments/status/:id` (status + libera).

**Painel admin — aba Financeiro:** total faturado, consultas realizadas, pagamentos
aprovados, pagamentos pendentes e total de clientes.

## Relatório Premium em PDF (NOVO)

Cada consulta liberada pode virar um **PDF premium** com a identidade Oráculo da Alma:
fundo azul estrelado, ouro, emblema, medalhão do signo solar, mapa visual
(Sol, Lua, Ascendente, elemento dominante) e a leitura em páginas temáticas.

- Botão **"📄 Baixar relatório premium"** na tela de resultado.
- O PDF é gerado com **pdfkit** (100% JavaScript, sem compilação nativa).
- Uma cópia é salva no histórico (`data/pdfs/consulta_<id>.pdf`) e o caminho registrado no banco.
- O **Super Admin** gera e baixa PDFs ilimitados, sem cobrança.
- No painel admin, o resumo mostra **PDFs gerados**.

Rota: `GET /api/consultations/:id/pdf` (logado; admin acessa qualquer uma).

## Integrações opcionais / futuras

Variáveis adicionadas ao `.env` (apenas como ambiente, nunca no código):

- `ASTROLOGY_API_KEY` — para um provedor externo de astrologia (opcional). **O sistema já
  calcula tudo localmente** (Ocidental + Védico + Nakshatra + Dashas) com efemérides reais,
  então não depende dessa API. Para usar um provedor externo, é preciso a documentação dele.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_INSTANCE` — preparadas para a
  integração futura de envio do PDF por WhatsApp (Evolution API).

## Modo Dono/Admin (NOVO)

O sistema diferencia **admin** de **customer** pelo campo `role`.

**Super Admin** (criado automaticamente na subida do servidor):
- Nome: Alessandro Valentim
- E-mail: alelimavalent@gmail.com
- Senha: Alessandro@2026
- Papel: `superadmin`

**Regras:**
- Admin/Super Admin faz consultas **grátis e ilimitadas** (sem PIX), geradas na hora — status `gratis_admin`.
- Cliente comum (`customer`) só consulta após pagamento PIX (valor editável, padrão **R$ 39,99**).
- Status de pagamento por consulta: `pendente`, `pago`, `gratis_admin`.

**Painel administrativo:** acesse `/admin` (logado como admin). Mostra:
- **IA / OpenAI:** se a chave está configurada (erro claro se faltar) e botão para **testar a qualidade da IA**.
- **Consultas:** todas as consultas (nome, e-mail, data, pergunta, resposta da IA, status de pagamento).
- **Usuários:** lista de usuários e papéis.
- **Configurações:** alterar o valor da consulta.

No app principal, o admin vê o botão **"Painel administrativo"**.

**OpenAI:** a chave fica só no `.env` (`OPENAI_API_KEY=coloque_sua_chave_aqui`), nunca no código.
Se faltar, o painel mostra o erro e as interpretações ficam indisponíveis.

**Endpoint temporário:** `POST /api/admin/reset-master` recria o Super Admin. Remova após confirmar o acesso.

## Etapa 2 — Motor astrológico real + IA (NOVO)

O sistema agora **calcula** o mapa de verdade com efemérides (Swiss Ephemeris).
A IA **não inventa** nada: ela recebe o JSON técnico calculado e apenas interpreta.

### O que é calculado de verdade

**Astrologia Ocidental (tropical, casas Placidus):**
Sol, Lua, Ascendente, Meio do Céu, 12 casas, 10 planetas + Nodo Norte,
aspectos maiores, distribuição de elementos e modalidades.

**Astrologia Védica (sideral, ayanamsa Lahiri):**
Sol/Lua/Ascendente védicos, Nakshatra e Pada da Lua, Rashi, Lagna,
9 grahas (com Ketu), e a **Vimshottari Dasha** completa com datas reais
e marcação do período ativo agora.

### Veja o motor funcionando (sem precisar de OpenAI nem pagamento)

```bash
node src/utils/testChart.js
```
Isso calcula um mapa de exemplo e imprime o JSON técnico.

### Fluxo de uma consulta

1. `POST /api/consultations` — cria a consulta e um pagamento PIX **pendente**
2. (pagamento) — em produção, o webhook do PIX confirma; em testes, um admin chama:
   `POST /api/consultations/:id/confirm`
3. Ao confirmar, o backend **calcula o mapa** e a **OpenAI interpreta**
4. `GET /api/consultations` — histórico ("Minhas Consultas")
5. `GET /api/consultations/:id` — leitura completa liberada

### Tipos de consulta

- `mapa_astral` e `astrologia_vedica` — usam o cálculo por efemérides
- `tarot` — 3 cartas tiradas no servidor (baralho de 78), IA interpreta
- `buzios` — 16 conchas lançadas no servidor, IA interpreta

### IMPORTANTE: coordenadas da cidade

Para calcular Ascendente e casas, o backend precisa de **latitude**, **longitude**
e **timezone** (IANA, ex.: `America/Sao_Paulo`). O nome da cidade sozinho não basta.
O frontend deve geocodificar a cidade (ex.: API gratuita Nominatim/OpenStreetMap)
e enviar lat/lon junto. Exemplo de corpo:

```json
{
  "type": "mapa_astral",
  "birth": {
    "nome": "Maria das Estrelas",
    "dataNascimento": "1990-05-12",
    "horaNascimento": "14:30",
    "cidadeNascimento": "Belo Horizonte",
    "paisNascimento": "Brasil",
    "timezone": "America/Sao_Paulo",
    "latitude": -19.9167,
    "longitude": -43.9345
  }
}
```

### Aviso obrigatório (exibir no app)

> As interpretações são voltadas para autoconhecimento, espiritualidade e
> entretenimento. Não substituem orientação médica, jurídica, psicológica ou financeira.

### Motor de efemérides (pure JavaScript)

Os cálculos usam **astronomy-engine**, uma efeméride de alta precisão escrita
100% em JavaScript. **Não precisa de Python, compilador C++ nem node-gyp.**
Funciona no Node 18, 20, 22 e 24.

As posições equivalem ao Swiss Ephemeris para fins astrológicos (diferença
inferior a ~1 minuto de arco). As casas usam o sistema de **signo inteiro
(Whole Sign)**, tradicional na astrologia védica e amplamente usado no Ocidente.

#### Windows — instalação em 1 passo
Dê dois cliques em **`install.bat`** (ou rode no terminal). Ele verifica o Node,
cria o `.env`, instala as dependências e inicia o servidor. Não exige Python.

## Etapa 3 — Frontend web responsivo (NOVO)

Interface completa na identidade visual da logo (navy cósmico, ouro, violeta, creme),
servida pelo próprio backend. Sem etapa de build — é HTML/CSS/JS puro.

Depois de subir o servidor (`npm start`), abra no navegador:

```
http://localhost:3000
```

Funciona no celular pelo navegador desde já. Telas incluídas:
- Início (com o emblema e o slogan "O universo fala com você")
- Cadastro (todos os campos) e Login
- Recuperar e redefinir senha
- Painel com as 4 consultas (Mapa Astral, Astrologia Védica, Tarot, Búzios)
- Formulário de nascimento (geocodifica a cidade automaticamente via OpenStreetMap)
- Tela de pagamento PIX (R$ 39,90) — aguardando integração da próxima etapa
- Resultado da leitura com o aviso obrigatório
- Histórico "Minhas consultas"

### Testando o fluxo completo de uma consulta agora

A trava de pagamento é real. Para ver uma leitura de ponta a ponta em teste:

1. Crie um admin: `node src/utils/createAdmin.js admin@oraculo.com SuaSenha123`
2. Configure a `OPENAI_API_KEY` no `.env` (senão a interpretação falha)
3. No app, faça uma consulta até a tela de pagamento (anote o ID que aparece nos logs/histórico)
4. Como admin, confirme o pagamento (libera o cálculo + IA):
   `POST /api/consultations/ID/confirm` com o token de admin
5. No app, clique em "Verificar pagamento" — a leitura aparece

Na próxima etapa, o PIX real confirma esse passo automaticamente via webhook.

### O preço da consulta é R$ 39,90

Definido em um único lugar (`src/controllers/consultationController.js`,
constante `VALOR_CENTAVOS = 3990`). Para mudar, altere essa constante.

## Próximas etapas (planejadas)

4. Integração PIX real (QR Code + webhook de confirmação automática)
5. Geração de PDF profissional com a marca Oráculo da Alma
6. Painel administrativo completo

---
Oráculo da Alma — feito com cuidado.

# Skills Marketplace (CLI) — Arquitetura

Marketplace **interno** de skills, operado inteiramente por **linha de comando**.
Sem interface gráfica, sem microserviços, sem servidor. O "backend" é um
**repositório Git** que guarda as skills e um índice. O CLI (`skills`) clona/atualiza
esse repo, busca, instala e publica skills.

O CLI é escrito em **TypeScript** e distribuído como **pacote privado no GitHub
Packages** (`@jorgemjuniorfitec/skills`), instalável com
`npm install -g @jorgemjuniorfitec/skills`.

> Filosofia: usar o que já existe (Git + GitHub Packages + filesystem). A
> primeira versão precisa ser instalável e útil em um dia.

---

## 1. Como funciona (visão geral)

```
┌─────────────────┐         git pull/push        ┌──────────────────────┐
│  CLI `skills`   │ ───────────────────────────► │  Repositório Git      │
│  (na máquina    │ ◄─────────────────────────── │  (o "marketplace")    │
│   do usuário)   │                              │                       │
└────────┬────────┘                              │  index.json           │
         │ instala                               │  skills/              │
         ▼                                       │    cep-lookup/        │
┌─────────────────┐                              │      skill.yaml       │
│ ~/.skills/      │                              │      main.py          │
│   (skills       │                              │    gerar-relatorio/   │
│    instaladas)  │                              │      skill.yaml       │
└─────────────────┘                              └──────────────────────┘
```

- **Marketplace = um repositório Git interno.** Cada skill é uma pasta.
- **Publicar** = adicionar a pasta + atualizar `index.json` + commit/push (ou abrir PR).
- **Instalar** = copiar a skill do repo clonado para `~/.skills/<nome>`.
- **Descoberta** = ler o `index.json` (busca por nome, tag, descrição).

---

## 2. Anatomia de uma Skill

Cada skill é uma pasta. O conteúdo é escrito **uma vez, de forma neutra**, e o
instalador o adapta para a ferramenta de cada dev. A estrutura é **em camadas**:
o mínimo é `skill.yaml` + `content.md`; as demais camadas são opcionais e entram
conforme a skill amadurece.

```
skills/<nome>/
├── skill.yaml          # OBRIGATÓRIO — manifesto (fonte única da verdade)
├── content.md          # OBRIGATÓRIO — payload neutro da skill
├── README.md           # recomendado — doc para humanos no catálogo
├── CHANGELOG.md        # recomendado — o que mudou entre versões
├── targets/            # opcional — override de conteúdo por ferramenta
│   └── copilot.md      #   usado no lugar do content.md p/ aquele alvo
├── examples/           # opcional — casos de uso, entradas/saídas
├── assets/             # opcional — arquivos referenciados (scripts, templates)
└── eval/
    └── cases.yaml      # opcional — prova que a skill funciona (regressão)
```

### Manifesto (`skill.yaml`)

```yaml
name: commit-conventions
version: 1.0.0
description: Padrão de mensagens de commit do time
type: instruction         # instruction | prompt | command | script | template
content: content.md

status: stable            # experimental | beta | stable | deprecated
owners:                   # governança: quem chamar quando quebrar
  team: plataforma
  contact: "#guilda-dev"
category: git

tags: [git, padrao]
targets: all              # ou [claude, copilot]
scope: project            # project | global

requires:                 # dependências verificáveis
  tools: []               #   ex.: [node>=18, gh]
  env: []                 #   ex.: [JIRA_TOKEN]
  mcp: []
variables: []             # parâmetros (templates/prompts)
```

Campos que sustentam a robustez num marketplace **interno**:
- **`status`** — separa experimento de padrão oficial (evita catálogo-lixão).
- **`owners.contact`** — a pergunta nº1 quando algo quebra é "quem eu chamo?".
- **`requires`** — evita o "instalei e não funciona" silencioso.

Tipos de skill suportados:

| type          | O que é                              | Para quem serve                       |
|---------------|--------------------------------------|---------------------------------------|
| `instruction` | Regras/contexto persistente p/ a IA  | Claude (CLAUDE.md), Copilot, Cursor   |
| `prompt`      | Prompt reutilizável (one-shot)       | qualquer assistente de IA             |
| `command`     | Slash command / prompt file          | Claude (commands), Copilot prompts    |
| `script`      | Script executável (node/shell)       | rodado via `skills run`               |
| `template`    | Boilerplate de arquivos              | copiado para o diretório atual        |

### Override por ferramenta (`targets/<alvo>.md`)

90% das skills usam só o `content.md` neutro. Quando o fraseado precisa diferir
por ferramenta, basta criar `targets/<alvo>.md` — o adapter usa o override se
existir e cai no neutro caso contrário. Zero configuração extra no manifesto.

### Validação (`skills lint`) e autoria (`skills new`)

- **`skills new <nome>`** gera a pasta já na estrutura recomendada (manifesto
  rico, content, README, CHANGELOG e `eval/cases.yaml`). A "forma certa" é o
  caminho de menor esforço.
- **`skills lint`** roda no **CI do marketplace** e barra PR com erro: manifesto
  inválido, `content`/`entrypoint` inexistente, `name` ≠ pasta, override para
  alvo desconhecido, `eval/cases.yaml` malformado. Avisos (sem README/CHANGELOG,
  `status: experimental`) não bloqueiam.
- **`skills eval <dir>`** roda os casos: para `script`, executa o entrypoint e
  compara o stdout; para `prompt`/`instruction`, valida a estrutura (execução
  real do prompt exige provider de IA — fase futura).

---

## 2.1 Instalador multi-ferramenta (o "assistente de instalação")

> Times mistos: alguns devs usam **GitHub Copilot**, outros **Claude**, e as
> **IDEs variam** (VS Code, JetBrains, Cursor...). A skill não pode assumir um
> formato/local único. A solução é separar **conteúdo neutro** de **adaptadores**.

```
                          skill (content.md neutro)
                                    │
                    ┌───────────────┼────────────────────┐
                    ▼               ▼                     ▼
            ┌───────────┐   ┌───────────┐         ┌─────────────┐
            │ adapter   │   │ adapter   │   ...   │ adapter      │
            │ claude    │   │ copilot   │         │ cursor/vscode│
            └─────┬─────┘   └─────┬─────┘         └──────┬──────┘
                  ▼               ▼                      ▼
        .claude/ , CLAUDE.md   .github/copilot-      .cursor/rules/ ,
        .claude/commands/      instructions.md ,     .vscode/ ...
                               .github/prompts/
```

### Como funciona o assistente
Ao rodar `skills install <nome>`, o CLI:
1. **Detecta** o ambiente do projeto/dev (procura `.claude/`, `.github/`,
   `.cursor/`, `.vscode/`, `.idea/`, etc.) e quais ferramentas estão presentes.
2. **Cruza** com os `targets` declarados na skill.
3. **Pergunta** (interativo) ou usa flags (`--target claude,copilot`) para
   confirmar onde instalar — com a opção "todos os detectados".
4. **Renderiza** o conteúdo via adapter e grava no local certo de cada ferramenta.
5. **Registra** a instalação em `~/.skills/installed/<nome>` (manifest + de-onde),
   permitindo `update` e `remove` limpos.

### Mapa de adaptadores (alvos da v1)

| Adapter    | Onde escreve (projeto)                              | Tipos suportados            |
|------------|----------------------------------------------------|-----------------------------|
| `claude`   | `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`| instruction, command, prompt|
| `copilot`  | `.github/copilot-instructions.md`, `.github/prompts/`| instruction, command, prompt|
| `cursor`   | `.cursor/rules/*.mdc`                               | instruction, prompt         |
| `vscode`   | `.vscode/` (settings/prompts) ou arquivo + instrução| prompt, template            |
| `jetbrains`| `.idea/` ou pasta de projeto + instrução           | prompt, template            |
| `generic`  | copia o arquivo + imprime instruções de uso        | qualquer                    |

> O conjunto de adapters é **plugável**: adicionar/remover uma ferramenta é
> escrever um novo módulo em `src/adapters/` sem mexer no resto. Assim o
> marketplace acompanha novas IDEs/assistentes sem reescrever skills.

### Escopo: projeto vs. global
- **Projeto** (padrão): grava nos arquivos do repositório atual (versionável,
  compartilhado pelo time daquele projeto).
- **Global** (`--global`): grava na config do usuário (ex.: `~/.claude/`,
  settings do VS Code), valendo para todos os projetos do dev.

---

## 3. O Índice (`index.json`)

Gerado/atualizado pelo CLI a partir dos `skill.yaml`. Evita varrer o repo inteiro
em cada busca.

```json
{
  "updated_at": "2026-06-18T10:00:00Z",
  "skills": [
    {
      "name": "cep-lookup",
      "version": "1.0.0",
      "description": "Consulta endereço a partir de um CEP",
      "author": "jorge@empresa.com",
      "tags": ["util", "http", "brasil"],
      "path": "skills/cep-lookup"
    }
  ]
}
```

---

## 4. Comandos do CLI (v1)

```bash
skills init                       # configura o repo do marketplace (URL Git)
skills update                     # git pull do repo do marketplace
skills search <termo>             # busca no index.json (nome/desc/tags)
skills info <nome>                # mostra detalhes de uma skill
skills doctor                     # detecta ferramentas/IDEs presentes no ambiente
skills install <nome> [opts]      # assistente: detecta alvos e instala (ver abaixo)
skills list                       # lista skills instaladas localmente
skills run <nome> [args]          # executa uma skill instalada (type: script)
skills publish <pasta>            # valida, adiciona ao repo, atualiza index e commita
skills remove <nome>              # remove skill instalada (de todos os alvos)
```

Opções do `install`:
```bash
skills install commit-conventions               # interativo: detecta e pergunta os alvos
skills install commit-conventions --target claude,copilot   # alvos explícitos
skills install commit-conventions --all         # todos os alvos detectados
skills install commit-conventions --global      # instala na config do usuário, não no projeto
skills install commit-conventions --yes         # não-interativo (CI/scripts)
```

Fluxo típico de quem **consome**:
```bash
skills init https://github.com/jorgemjuniorfitec/teste-repo.git
skills update
skills doctor                  # "Detectado: Claude (.claude/), Copilot (.github/)"
skills search commit
skills install commit-conventions   # pergunta: instalar para Claude? Copilot? ambos?
```

Fluxo típico de quem **publica**:
```bash
skills publish ./minha-skill      # valida o skill.yaml, copia p/ repo clonado
                                  # atualiza index.json e faz commit
git push                          # ou o CLI abre um PR (config opcional)
```

---

## 5. Estrutura do Projeto (código do CLI)

```
skills-cli/
├── package.json             # nome @empresa/skills, bin "skills", scripts
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md          # este documento
├── src/
│   ├── index.ts             # entrypoint do bin (shebang) + registro de comandos
│   ├── cli.ts               # definição dos comandos (Commander)
│   ├── config.ts            # ~/.skills/config.json (URL do repo, paths)
│   ├── registry.ts          # clone/pull do repo, leitura do index.json
│   ├── manifest.ts          # parse + validação do skill.yaml (zod)
│   ├── detect.ts            # detecção de ferramentas/IDEs no ambiente
│   ├── installer.ts         # orquestra: escolhe adapters, grava, registra
│   ├── runner.ts            # executar skill instalada (run)
│   ├── publisher.ts         # publish: validar, copiar, atualizar index, commit
│   └── adapters/            # um módulo por ferramenta (plugável)
│       ├── types.ts         #   interface Adapter { id, detect(), apply(), remove() }
│       ├── claude.ts
│       ├── copilot.ts
│       ├── cursor.ts
│       ├── vscode.ts
│       ├── jetbrains.ts
│       ├── generic.ts
│       └── index.ts         #   registro de todos os adapters
├── dist/                    # saída compilada (tsup) — publicada no GitHub Packages
└── tests/
    ├── manifest.test.ts
    ├── registry.test.ts
    ├── detect.test.ts
    └── adapters/
        ├── claude.test.ts
        └── copilot.test.ts
```

Diretórios usados em runtime na máquina do usuário:
```
~/.skills/
├── config.json             # URL do marketplace + preferências
├── cache/                  # clone local do repo do marketplace
└── installed/              # skills instaladas
    └── cep-lookup/
```

---

## 6. Stack e Dependências

| Item            | Escolha                       | Motivo                                          |
|-----------------|-------------------------------|-------------------------------------------------|
| Linguagem       | TypeScript (Node 18+)         | pedido do time; permite publicar no NPM         |
| Framework CLI   | Commander (+ chalk/ora)       | comandos declarativos, help e spinners          |
| Manifesto       | YAML (`yaml`) validado c/ zod | legível p/ humanos + validação de schema        |
| Backend         | Git (via `simple-git`)        | zero infra nova, versionamento de graça         |
| Build           | tsup (esbuild)                | bundle rápido de `src` → `dist`                 |
| Distribuição    | GitHub Packages (privado)     | grátis p/ repo privado, usa permissões do GitHub|
| Testes          | Vitest                        | rápido, integrado ao ecossistema TS             |

---

## 7. Decisões e Trade-offs

- **Git como backend:** sem servidor para manter; permissões e histórico vêm do
  próprio GitHub/GitLab interno. Limitação: descoberta é "puxada" (precisa de
  `update`), não tem estatísticas de uso em tempo real. Aceitável na v1.
- **`publish` commita direto vs. abre PR:** v1 commita na branch; revisão por PR
  fica como flag opcional (`--pr`) numa fase seguinte.
- **Sem sandbox de execução:** `skills run` executa código com a permissão do
  usuário. Mitigação v1: só instalar de repo interno confiável + revisão por PR.
  Sandbox (subprocesso isolado) fica para fase futura.

---

## 7.1 Distribuição via GitHub Packages

O CLI é publicado como pacote **scoped privado** no GitHub Packages. O escopo do
pacote **precisa bater com o owner do repositório no GitHub** — daí
`@jorgemjuniorfitec/skills`.

`package.json` (trechos relevantes):
```json
{
  "name": "@jorgemjuniorfitec/skills",
  "version": "1.0.0",
  "bin": { "skills": "dist/index.js" },
  "files": ["dist"],
  "type": "module",
  "engines": { "node": ">=18" },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jorgemjuniorfitec/teste-repo.git"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --clean",
    "prepublishOnly": "npm run build"
  }
}
```

### Publicação
A forma recomendada é via **GitHub Actions** (sem token pessoal no processo):

```yaml
# .github/workflows/publish.yml
name: Publish package
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write          # permite publicar no GitHub Packages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
      - run: npm ci
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Publicação manual (alternativa), usando um PAT com escopo `write:packages`:
```bash
npm publish
```

### Instalação pelos colaboradores
Cada pessoa precisa de um **Personal Access Token** com `read:packages` e de
um `.npmrc` apontando o escopo para o GitHub Packages:

```ini
# ~/.npmrc
@jorgemjuniorfitec:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```
```bash
npm install -g @jorgemjuniorfitec/skills
```

> Vantagens vs. NPM privado: **sem custo extra** para repositórios privados e as
> permissões de quem pode ler/publicar vêm direto do acesso ao repositório no
> GitHub. Custo: todo mundo precisa configurar um PAT no `.npmrc` (passo único).

---

## 8. Roadmap

### v1 — MVP (o essencial)
- [ ] `init`, `update`, `search`, `info`, `list`
- [ ] Parse e validação do `skill.yaml` (zod)
- [ ] Leitura do `index.json`
- [ ] `detect` + `doctor`: detecção de ferramentas/IDEs
- [ ] `install` com assistente multi-ferramenta + adapters `claude`, `copilot`, `generic`
- [ ] Publicar como `@jorgemjuniorfitec/skills` no GitHub Packages

### v2 — Mais alvos, publicação e qualidade
- [ ] Adapters `cursor`, `vscode`, `jetbrains`
- [ ] `run` para skills do tipo `script`
- [ ] `publish` com geração automática do `index.json`
- [ ] `--pr` para abrir Pull Request em vez de commit direto
- [ ] Versionamento (instalar versão específica, `skills update <nome>`)
- [ ] Validação de schema mais rígida + lint de skills

### v3 — Conveniências
- [ ] Cache de busca e ranking simples (mais instaladas primeiro)
- [ ] `skills stats` (contagem de instalações via metadados no repo)
- [ ] Sandbox opcional de execução (subprocesso isolado por skill)

---

## 9. Próximos Passos

1. Confirmar o escopo no GitHub Packages (`@jorgemjuniorfitec` ou uma org) e o fluxo de PAT para o time.
2. Criar o repositório Git interno que servirá de marketplace (vazio, com 1 skill de exemplo).
3. Scaffold do CLI TypeScript (`package.json` + `src/cli.ts` com os comandos da v1).
4. Implementar o caminho feliz: `init → update → search → install → run`.
5. Publicar a `v0` no GitHub Packages e testar com 2–3 skills reais do time.

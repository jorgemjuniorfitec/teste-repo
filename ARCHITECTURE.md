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

Cada skill é uma pasta com um manifesto `skill.yaml`:

```yaml
# skills/cep-lookup/skill.yaml
name: cep-lookup
version: 1.0.0
description: Consulta endereço a partir de um CEP
author: jorge@empresa.com
tags: [util, http, brasil]
type: script            # script | prompt | template
entrypoint: main.py     # arquivo executado ao rodar a skill
runtime: python         # python | shell | none
```

Tipos de skill suportados na v1:

| type     | O que é                            | Como roda                       |
|----------|------------------------------------|---------------------------------|
| `script` | Script executável (Python/shell)   | `skills run <nome> [args]`      |
| `prompt` | Prompt/template de IA              | copiado p/ uso manual ou agente |
| `template`| Boilerplate de arquivos           | copiado para o diretório atual  |

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
skills init                 # configura o repo do marketplace (URL Git) localmente
skills update               # git pull do repo do marketplace
skills search <termo>       # busca no index.json (nome/desc/tags)
skills info <nome>          # mostra detalhes de uma skill
skills install <nome>       # copia a skill para ~/.skills/<nome>
skills list                 # lista skills instaladas localmente
skills run <nome> [args]    # executa uma skill instalada
skills publish <pasta>      # valida, adiciona ao repo, atualiza index e commita
skills remove <nome>        # remove skill instalada localmente
```

Fluxo típico de quem **consome**:
```bash
skills init https://git.empresa.com/skills-marketplace.git
skills update
skills search relatorio
skills install gerar-relatorio
skills run gerar-relatorio --mes 06
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
│   ├── installer.ts         # copiar skill p/ ~/.skills, listar, remover
│   ├── runner.ts            # executar skill instalada (run)
│   └── publisher.ts         # publish: validar, copiar, atualizar index, commit
├── dist/                    # saída compilada (tsup) — publicada no NPM
└── tests/
    ├── manifest.test.ts
    ├── registry.test.ts
    └── installer.test.ts
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
- [ ] `init`, `update`, `search`, `info`, `install`, `list`, `run`
- [ ] Parse e validação do `skill.yaml` (zod)
- [ ] Leitura do `index.json`
- [ ] Publicar como `@jorgemjuniorfitec/skills` no GitHub Packages

### v2 — Publicação e qualidade
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

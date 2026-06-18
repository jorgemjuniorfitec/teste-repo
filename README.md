# @jorgemjuniorfitec/skills

CLI do **marketplace interno de skills de IA**. As skills são escritas uma vez de
forma neutra e o instalador as adapta para a ferramenta de cada dev — **Claude**,
**GitHub Copilot**, IDEs diversas ou um fallback genérico.

> Arquitetura completa em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Instalação

1. Crie um **Personal Access Token (classic)** com o escopo **`read:packages`**
   em https://github.com/settings/tokens.
2. Adicione **as duas linhas** abaixo ao seu `~/.npmrc` pessoal
   (no Windows: `C:\Users\<voce>\.npmrc`), trocando `{SEU_TOKEN}` pelo token:
   ```ini
   @jorgemjuniorfitec:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken={SEU_TOKEN}
   ```
   > A primeira linha é obrigatória: ela roteia o escopo para o GitHub Packages.
   > Sem ela, o npm procura no npmjs.org e retorna **404**.
   > Não coloque o token numa linha solta como `GITHUB_TOKEN=...` — npm ignora.
3. Instale o CLI:
   ```bash
   npm install -g @jorgemjuniorfitec/skills
   ```

## Comandos

### Configuração inicial

| Comando | O que faz |
|---|---|
| `skills init <url-git>` | Aponta o CLI para o repositório do marketplace. Necessário apenas uma vez por máquina. |
| `skills update` | Baixa as últimas skills do repositório (`git pull`). Rode antes de buscar ou instalar. |

### Descoberta

| Comando | O que faz |
|---|---|
| `skills search <termo>` | Busca skills por nome, descrição ou tag no catálogo local. |
| `skills info <nome>` | Exibe detalhes de uma skill: versão, tipo, status, quem mantém, dependências e alvos. |
| `skills doctor` | Detecta quais ferramentas de IA e IDEs estão presentes no projeto atual (`.claude/`, `.github/`, etc.). |

### Instalação

| Comando | O que faz |
|---|---|
| `skills install <nome>` | Abre o assistente interativo: detecta as ferramentas presentes e pergunta onde instalar. |
| `skills install <nome> --target claude,copilot` | Instala diretamente nos alvos indicados, sem perguntar. |
| `skills install <nome> --all` | Instala em todos os alvos detectados no projeto. |
| `skills install <nome> --global` | Instala na config pessoal do usuário (`~/.claude/`, etc.) em vez do projeto atual. |
| `skills install <nome> --yes` | Não-interativo; assume os alvos detectados. Útil em scripts. |
| `skills list` | Lista as skills instaladas na máquina com versão e alvos. |
| `skills remove <nome>` | Remove a skill de todos os alvos onde foi instalada. |

### Autoria (para quem contribui com skills)

| Comando | O que faz |
|---|---|
| `skills new <nome>` | Gera o esqueleto de uma skill na estrutura recomendada: `skill.yaml`, `content.md`, `README.md`, `CHANGELOG.md` e `eval/cases.yaml`. |
| `skills new <nome> --type <tipo>` | Idem, com tipo explícito (`instruction`, `prompt`, `command`, `script`, `template`). |
| `skills lint [dir]` | Valida uma skill ou todo o catálogo: manifesto, conteúdo, overrides e eval. Erros bloqueiam o PR no CI; avisos são recomendações. |
| `skills eval <dir>` | Executa os casos de teste em `eval/cases.yaml`. Para scripts: roda o entrypoint e compara o stdout. Para prompts: valida a estrutura. |
| `skills index` | Regenera o `index.json` a partir das pastas em `skills/`. Rode e commite junto com a skill nova. |
| `skills index --check` | Verifica se o `index.json` está em dia com as skills (usado pelo CI — não escreve nada). |

### Fluxo típico — consumidor

```bash
skills init https://github.com/jorgemjuniorfitec/teste-repo.git
skills update
skills doctor                        # veja o que foi detectado no seu projeto
skills search commit
skills info commit-conventions       # veja detalhes antes de instalar
skills install commit-conventions    # assistente pergunta: Claude? Copilot? ambos?
```

### Fluxo típico — autor de skill

```bash
skills new minha-skill               # gera o esqueleto
# edite skill.yaml e content.md ...
skills lint skills/minha-skill       # valide localmente antes do PR
skills eval skills/minha-skill       # rode os casos de eval
skills index                         # regenere o index.json
git add skills/minha-skill index.json
git commit && git push
# abra o Pull Request — o CI e um owner do catálogo vão revisar
```

### Onde cada ferramenta recebe a skill

| Ferramenta | `instruction` | `command` | `prompt` |
|------------|---------------|-----------|----------|
| Claude | bloco em `CLAUDE.md` | `.claude/commands/<nome>.md` | `.claude/skills/<nome>.md` |
| Copilot | `.github/copilot-instructions.md` | `.github/prompts/<nome>.prompt.md` | `.github/prompts/<nome>.prompt.md` |
| Genérico | `.skills/<nome>.md` | `.skills/<nome>.md` | `.skills/<nome>.md` |

> Skills podem ter um arquivo `targets/<ferramenta>.md` com conteúdo específico
> para aquela ferramenta. Sem ele, o instalador usa o `content.md` neutro.

## Desenvolvimento

```bash
npm install
npm run dev -- --help     # roda o CLI via tsx
npm test                  # vitest
npm run build             # gera dist/ (tsup)
```

## Publicar uma nova versão

Crie um *release* no GitHub; o workflow `publish.yml` builda e publica no
GitHub Packages automaticamente.

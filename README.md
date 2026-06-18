# @jorgemjuniorfitec/skills

CLI do **marketplace interno de skills de IA**. As skills são escritas uma vez de
forma neutra e o instalador as adapta para a ferramenta de cada dev — **Claude**,
**GitHub Copilot**, IDEs diversas ou um fallback genérico.

> Arquitetura completa em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Instalação

1. Configure o acesso ao GitHub Packages (passo único):
   ```bash
   cp .npmrc.example ~/.npmrc       # ou edite seu ~/.npmrc
   export GITHUB_TOKEN=ghp_xxx      # PAT com escopo read:packages
   ```
2. Instale o CLI:
   ```bash
   npm install -g @jorgemjuniorfitec/skills
   ```

## Uso

```bash
skills init https://github.com/jorgemjuniorfitec/teste-repo.git
skills update
skills doctor                      # detecta Claude/Copilot/IDEs no projeto
skills search commit
skills install commit-conventions  # assistente: pergunta os alvos detectados
skills list
skills remove commit-conventions
```

### Como o assistente de instalação escolhe os alvos

1. Detecta ferramentas presentes (`.claude/`, `.github/`, etc.).
2. Cruza com os `targets` declarados na skill.
3. Pergunta de forma interativa (ou use `--target`, `--all`, `--yes`).
4. Renderiza o conteúdo no formato/local de cada ferramenta.

| Ferramenta | Onde instala (instruction)            |
|------------|---------------------------------------|
| Claude     | bloco gerenciado em `CLAUDE.md`       |
| Copilot    | `.github/copilot-instructions.md`     |
| Genérico   | `.skills/<nome>.md`                   |

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

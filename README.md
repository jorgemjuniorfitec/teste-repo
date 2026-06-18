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

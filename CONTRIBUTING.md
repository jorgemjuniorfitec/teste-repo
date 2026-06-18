# Como contribuir com uma skill

A publicação de skills é **exclusivamente via Git + Pull Request**, com
**aprovação humana obrigatória**. Não existe comando que envie skills direto para
o repositório — nada entra no catálogo sem passar pelo crivo de um owner.

## Fluxo

1. **Crie uma branch** a partir da `main`.
2. **Gere o esqueleto** da skill na estrutura recomendada:
   ```bash
   skills new minha-skill            # ou: skills new minha-skill --type prompt
   ```
3. **Edite** `skill.yaml` e `content.md` (e, se precisar, `README.md`,
   `targets/<alvo>.md`, `eval/cases.yaml`).
4. **Valide localmente** antes de abrir o PR:
   ```bash
   skills lint skills/minha-skill    # manifesto, conteúdo, overrides, eval
   skills eval skills/minha-skill    # casos de eval
   skills index                      # regenera o index.json (não edite à mão)
   ```
5. **Commite** a pasta da skill **e** o `index.json` atualizado.
6. **Abra o Pull Request.**

## O que o CI verifica (bloqueia o merge se falhar)

- `typecheck` + testes do CLI.
- `skills lint`: manifesto válido, `content`/`entrypoint` existentes, `name`
  igual ao da pasta, overrides para alvos conhecidos, `eval/cases.yaml` válido.
- `skills index --check`: o `index.json` commitado reflete as skills.

## Revisão humana

O arquivo [`.github/CODEOWNERS`](.github/CODEOWNERS) exige a aprovação de um
owner do catálogo para qualquer mudança em `skills/`. Recomenda-se proteger a
branch `main` exigindo: CI verde + ao menos 1 review de owner.

## Critérios de qualidade na revisão

- `description` clara (o que faz **e** quando usar).
- `owners.contact` preenchido (quem chamar quando quebrar).
- `status` honesto (`experimental`/`beta`/`stable`).
- Exemplos concretos no conteúdo; `eval` para skills críticas.

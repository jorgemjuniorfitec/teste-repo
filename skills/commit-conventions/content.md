## Convenção de mensagens de commit

Siga o padrão **Conventional Commits** ao gerar mensagens de commit:

```
<tipo>(<escopo opcional>): <descrição curta no imperativo>

<corpo opcional explicando o porquê>
```

Tipos permitidos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

Regras:
- Descrição em português, no imperativo ("adiciona", não "adicionado").
- Linha de assunto com no máximo 72 caracteres.
- Use o corpo para explicar o **porquê**, não o **como**.

Exemplos:
- `feat(auth): adiciona login via SSO`
- `fix(api): corrige timeout no endpoint de relatórios`

# Skills Marketplace (CLI) — Arquitetura

Marketplace **interno** de skills, operado inteiramente por **linha de comando**.
Sem interface gráfica, sem microserviços, sem servidor. O "backend" é um
**repositório Git** que guarda as skills e um índice. O CLI (`skills`) clona/atualiza
esse repo, busca, instala e publica skills.

> Filosofia: usar o que já existe (Git + filesystem). A primeira versão precisa
> ser instalável e útil em um dia.

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
skills-marketplace/
├── pyproject.toml            # empacotamento + dependência typer
├── README.md
├── ARCHITECTURE.md           # este documento
├── src/
│   └── skills/
│       ├── __init__.py
│       ├── cli.py            # definição dos comandos (Typer)
│       ├── config.py         # ~/.skills/config.toml (URL do repo, paths)
│       ├── registry.py       # clone/pull do repo, leitura do index.json
│       ├── manifest.py       # parse + validação do skill.yaml
│       ├── installer.py      # copiar skill p/ ~/.skills, listar, remover
│       ├── runner.py         # executar skill instalada (run)
│       └── publisher.py      # publish: validar, copiar, atualizar index, commit
└── tests/
    ├── test_manifest.py
    ├── test_registry.py
    └── test_installer.py
```

Diretórios usados em runtime na máquina do usuário:
```
~/.skills/
├── config.toml              # URL do marketplace + preferências
├── cache/                   # clone local do repo do marketplace
└── installed/               # skills instaladas
    └── cep-lookup/
```

---

## 6. Stack e Dependências

| Item            | Escolha                  | Motivo                                      |
|-----------------|--------------------------|---------------------------------------------|
| Linguagem       | Python 3.11+             | pedido do time; bom p/ scripts e IA         |
| Framework CLI   | Typer (+ Rich)           | comandos declarativos, help bonito          |
| Manifesto       | YAML (`pyyaml`)          | legível para humanos                        |
| Backend         | Git (subprocess/`git`)   | zero infra nova, versionamento de graça     |
| Empacotamento   | `pyproject.toml` + pipx  | instalação global isolada (`pipx install`)  |
| Testes          | pytest                   | padrão do ecossistema                       |

---

## 7. Decisões e Trade-offs

- **Git como backend:** sem servidor para manter; permissões e histórico vêm do
  próprio GitHub/GitLab interno. Limitação: descoberta é "puxada" (precisa de
  `update`), não tem estatísticas de uso em tempo real. Aceitável na v1.
- **`publish` commita direto vs. abre PR:** v1 commita na branch; revisão por PR
  fica como flag opcional (`--pr`) numa fase seguinte.
- **Sem sandbox de execução:** `skills run` executa código com a permissão do
  usuário. Mitigação v1: só instalar de repo interno confiável + revisão por PR.
  Sandbox (container/venv isolado) fica para fase futura.

---

## 8. Roadmap

### v1 — MVP (o essencial)
- [ ] `init`, `update`, `search`, `info`, `install`, `list`, `run`
- [ ] Parse e validação do `skill.yaml`
- [ ] Leitura do `index.json`
- [ ] Empacotar como `pipx install skills`

### v2 — Publicação e qualidade
- [ ] `publish` com geração automática do `index.json`
- [ ] `--pr` para abrir Pull Request em vez de commit direto
- [ ] Versionamento (instalar versão específica, `skills update <nome>`)
- [ ] Validação de schema mais rígida + lint de skills

### v3 — Conveniências
- [ ] Cache de busca e ranking simples (mais instaladas primeiro)
- [ ] `skills stats` (contagem de instalações via metadados no repo)
- [ ] Sandbox opcional de execução (venv isolado por skill)

---

## 9. Próximos Passos

1. Criar o repositório Git interno que servirá de marketplace (vazio, com 1 skill de exemplo).
2. Scaffold do CLI Python (`pyproject.toml` + `src/skills/cli.py` com os comandos da v1).
3. Implementar o caminho feliz: `init → update → search → install → run`.
4. Empacotar com pipx e testar com 2–3 skills reais do time.

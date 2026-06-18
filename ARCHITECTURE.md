# Skills Marketplace — Arquitetura

## Visão Geral

Plataforma interna onde colaboradores publicam, descobrem, instalam e avaliam **skills** reutilizáveis (automações, agentes IA, scripts, ferramentas internas). O objetivo é reduzir retrabalho e criar um catálogo centralizado do conhecimento operacional da empresa.

---

## 1. Entidades Principais

```
Skill
├── id, slug, nome, descrição
├── versão (semver)
├── categoria / tags
├── autor (User)
├── artefato (arquivo, script, endpoint, prompt)
├── metadados de execução (tipo, inputs, outputs)
├── status (rascunho | publicado | depreciado)
└── estatísticas (downloads, rating médio)

User
├── id, nome, email (SSO interno)
├── skills publicadas
├── skills instaladas
└── papel (colaborador | revisor | admin)

Review
├── skill_id, user_id
├── nota (1–5)
└── comentário

Installation
├── user_id, skill_id, versão
└── data de instalação

Category
└── id, nome, slug, ícone
```

---

## 2. Fluxos Principais

### 2.1 Publicar uma Skill
```
Autor → Portal Web → preenche formulário + upload do artefato
      → API (Node.js) → valida metadados e artefato
      → Storage (S3/MinIO) ← armazena artefato
      → Banco de dados ← persiste Skill (status: rascunho)
      → [opcional] Revisor aprova → status: publicado
      → Index de busca atualizado
```

### 2.2 Descobrir e Instalar uma Skill
```
Usuário → Portal Web → busca / filtra skills
        → API → consulta Elasticsearch/Postgres
        → retorna lista ranqueada (relevância + rating)
        → Usuário seleciona → clica "Instalar"
        → API registra Installation
        → retorna instruções de uso (CLI, endpoint, SDK)
```

### 2.3 Integração com Sistemas Java Legados
```
Sistema Java → chama Integration Gateway (REST/gRPC)
             → Gateway traduz para API interna
             → pode publicar skills geradas por automações Java
             → pode consultar o catálogo programaticamente
```

---

## 3. Arquitetura de Serviços

```
┌─────────────────────────────────────────────────────────┐
│                    Portal Web (Next.js)                  │
│  Catálogo · Busca · Perfil · Publicação · Admin          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────────┐
│               API Gateway (Node.js / TypeScript)         │
│  Authn/Authz (SSO) · Rate Limit · Roteamento             │
└───┬────────────┬──────────────┬──────────────┬──────────┘
    │            │              │              │
┌───▼───┐  ┌────▼────┐  ┌──────▼──────┐  ┌───▼─────────┐
│Catalog│  │Registry │  │Review/Rating│  │ Integration  │
│Service│  │Service  │  │   Service   │  │  Gateway     │
│(Node) │  │(Python) │  │   (Node)    │  │ (Java/Node)  │
└───┬───┘  └────┬────┘  └──────┬──────┘  └─────────────┘
    │            │              │
┌───▼────────────▼──────────────▼──────────────────────────┐
│                     PostgreSQL (principal)                │
│        + Redis (cache + sessões)                         │
│        + Elasticsearch (busca full-text)                 │
│        + S3 / MinIO (artefatos de skills)                │
└──────────────────────────────────────────────────────────┘
```

### Responsabilidades dos Serviços

| Serviço | Stack | Responsabilidade |
|---|---|---|
| **Portal Web** | Next.js 14 + React + Tailwind | UI pública e admin |
| **API Gateway** | Node.js + TypeScript (Fastify/Express) | Authn, roteamento, rate limit |
| **Catalog Service** | Node.js + TypeScript | Listagem, busca, filtros, categorias |
| **Registry Service** | Python (FastAPI) | Validação, versionamento, upload de artefatos |
| **Review Service** | Node.js + TypeScript | Ratings, comentários, moderação |
| **Integration Gateway** | Node.js ou Java Spring Boot | Bridge para sistemas internos legados |

---

## 4. Modelo de Dados (PostgreSQL)

```sql
-- Usuários (sincronizado com SSO)
users (id, email, name, role, created_at)

-- Categorias
categories (id, slug, name, icon, parent_id)

-- Skills
skills (id, slug, name, description, category_id, author_id,
        artifact_url, artifact_type, version, status,
        install_count, avg_rating, created_at, updated_at)

-- Versões de skills
skill_versions (id, skill_id, version, artifact_url,
                changelog, created_at)

-- Instalações
installations (id, user_id, skill_id, version, installed_at)

-- Reviews
reviews (id, skill_id, user_id, rating, comment, created_at)

-- Tags
tags (id, name)
skill_tags (skill_id, tag_id)
```

---

## 5. Autenticação e Autorização

- **SSO interno** (SAML 2.0 / OIDC) — nenhum cadastro manual.
- JWT com refresh token gerenciado pelo API Gateway.
- Papéis: `viewer`, `publisher`, `reviewer`, `admin`.
- Skills privadas: visíveis apenas a times específicos (RBAC por grupo).

---

## 6. Tipos de Artefato Suportados

| Tipo | Formato | Execução |
|---|---|---|
| **Script** | `.py`, `.sh`, `.js` | Via CLI local |
| **API/Endpoint** | URL + spec OpenAPI | Chamada REST |
| **Agente IA** | Prompt + config MCP | Claude Code / SDK |
| **Automação Java** | JAR + parâmetros | Invocado pelo Integration Gateway |
| **Workflow** | JSON (n8n, Prefect) | Engine de workflow |

---

## 7. Roadmap de Implementação

### Fase 1 — MVP (4–6 semanas)
- [ ] Scaffold do monorepo (Next.js + API Node.js)
- [ ] Autenticação SSO
- [ ] CRUD de skills (sem workflow de aprovação)
- [ ] Listagem, busca simples e página de detalhe
- [ ] Upload de artefato para S3/MinIO
- [ ] Instalação (registro + instruções de uso)

### Fase 2 — Qualidade e Descoberta (4 semanas)
- [ ] Sistema de reviews e ratings
- [ ] Busca full-text com Elasticsearch
- [ ] Categorias e tags
- [ ] Workflow de aprovação por revisores
- [ ] Versionamento de skills

### Fase 3 — Integração e Escala (4–6 semanas)
- [ ] Integration Gateway para sistemas Java
- [ ] Analytics de uso por skill
- [ ] Notificações (nova versão, aprovação, review)
- [ ] CLI para instalar/publicar skills via terminal
- [ ] API pública documentada (Swagger/OpenAPI)

---

## 8. Estrutura de Pastas Proposta

```
skills-marketplace/
├── apps/
│   ├── web/                  # Next.js — portal
│   └── api/                  # Node.js — API Gateway + serviços
│       ├── src/
│       │   ├── catalog/
│       │   ├── registry/
│       │   ├── reviews/
│       │   └── auth/
│       └── ...
├── services/
│   ├── registry-python/      # FastAPI — validação de artefatos
│   └── integration-gateway/  # Bridge Java/Node
├── packages/
│   ├── sdk/                  # SDK TypeScript para consumir skills
│   └── ui/                   # Design system compartilhado
├── infra/
│   ├── docker-compose.yml    # Dev local (Postgres, Redis, MinIO, ES)
│   └── k8s/                  # Manifests de produção
└── docs/
    └── ARCHITECTURE.md       # Este documento
```

---

## 9. Decisões Técnicas e Trade-offs

| Decisão | Escolha | Alternativa descartada | Motivo |
|---|---|---|---|
| Monorepo | Turborepo | Polyrepo | Facilita shared packages e CI unificado |
| ORM | Prisma (Node) + SQLAlchemy (Python) | Raw SQL | Migrations e type-safety |
| Busca | Elasticsearch | Postgres full-text | Escalabilidade e ranking |
| Storage | MinIO (self-hosted) | S3 AWS | Controle interno de dados |
| Auth | OIDC/SSO existente | Auth próprio | Evita gestão de credenciais |
| API style | REST + OpenAPI | GraphQL | Adoção mais simples para integrações Java |

---

## 10. Próximos Passos Imediatos

1. Validar este documento com os stakeholders técnicos.
2. Definir o SSO interno disponível (Keycloak? Azure AD? Google Workspace?).
3. Confirmar onde rodar a infra (on-premise, AWS, GCP).
4. Montar o scaffold do monorepo e subir o `docker-compose` de dev.
5. Criar o primeiro épico no board de tarefas com as tasks da Fase 1.

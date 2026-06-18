import { join } from "node:path";
import { writeFileEnsured, exists } from "./adapters/shared.js";
import type { SkillType } from "./manifest.js";

export interface NewSkillOptions {
  name: string;
  type: SkillType;
  /** Diretório onde criar a skill (default: ./skills). */
  baseDir: string;
}

/**
 * Cria o esqueleto de uma skill na "forma certa": manifesto rico, conteúdo
 * neutro, README, CHANGELOG e um eval inicial. Faz da boa estrutura o caminho
 * de menor esforço.
 */
export async function newSkill(opts: NewSkillOptions): Promise<string> {
  const dir = join(opts.baseDir, opts.name);
  if (await exists(dir)) {
    throw new Error(`já existe uma skill em ${dir}`);
  }

  await writeFileEnsured(join(dir, "skill.yaml"), manifestTemplate(opts));
  await writeFileEnsured(join(dir, "content.md"), contentTemplate(opts));
  await writeFileEnsured(join(dir, "README.md"), readmeTemplate(opts));
  await writeFileEnsured(join(dir, "CHANGELOG.md"), changelogTemplate());
  await writeFileEnsured(join(dir, "eval", "cases.yaml"), evalTemplate(opts));

  return dir;
}

function manifestTemplate({ name, type }: NewSkillOptions): string {
  const scriptFields =
    type === "script" ? "entrypoint: main.js\nruntime: node\n" : "";
  return `name: ${name}
version: 0.1.0
description: TODO descreva o que a skill faz e quando usar
type: ${type}
content: content.md

status: experimental
owners:
  team: TODO-seu-time
  contact: "TODO-canal-de-suporte"
category: TODO

tags: []

targets: all
scope: project

requires:
  tools: []
  env: []
  mcp: []

variables: []
${scriptFields}`;
}

function contentTemplate({ name, type }: NewSkillOptions): string {
  if (type === "script") {
    return `# ${name}\n\nTODO: descreva o que o script faz e como usá-lo.\n`;
  }
  return `## ${name}\n\nTODO: escreva aqui o conteúdo neutro da skill (instrução/prompt).\n\nUse exemplos concretos — é o que separa uma skill útil de uma vaga.\n`;
}

function readmeTemplate({ name }: NewSkillOptions): string {
  return `# ${name}

## O que faz
TODO

## Quando usar
TODO

## Como instalar
\`\`\`bash
skills install ${name}
\`\`\`

## Após instalar
TODO: instruções de uso por ferramenta, se necessário.
`;
}

function changelogTemplate(): string {
  return `# Changelog

## 0.1.0
- Versão inicial.
`;
}

function evalTemplate({ type }: NewSkillOptions): string {
  if (type === "script") {
    return `cases:
  - name: caso-basico
    args: ["--exemplo"]
    expect_contains: "TODO trecho esperado no stdout"
`;
  }
  return `cases:
  - name: caso-basico
    input: "TODO entrada de exemplo"
    expect_contains: "TODO comportamento esperado"
`;
}

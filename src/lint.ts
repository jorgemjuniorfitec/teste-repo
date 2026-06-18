import { join, basename } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { parseManifest, TargetSchema, type Manifest } from "./manifest.js";
import { parseEvalFile, EVAL_FILE } from "./eval.js";
import { exists } from "./adapters/shared.js";

export interface LintIssue {
  level: "error" | "warning";
  skill: string;
  message: string;
}

/**
 * Faz lint de UMA skill (pasta com skill.yaml). Erros bloqueiam publicação;
 * warnings são recomendações de robustez.
 */
export async function lintSkill(dir: string): Promise<LintIssue[]> {
  const skill = basename(dir);
  const issues: LintIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", skill, message });
  const warn = (message: string) => issues.push({ level: "warning", skill, message });

  const manifestPath = join(dir, "skill.yaml");
  if (!(await exists(manifestPath))) {
    error("skill.yaml ausente");
    return issues;
  }

  let manifest: Manifest;
  try {
    manifest = parseManifest(await readFile(manifestPath, "utf8"));
  } catch (err) {
    error((err as Error).message);
    return issues;
  }

  // Nome do manifesto deve bater com o da pasta.
  if (manifest.name !== skill) {
    error(`name "${manifest.name}" difere do nome da pasta "${skill}"`);
  }

  // Conteúdo neutro precisa existir.
  if (!(await exists(join(dir, manifest.content)))) {
    error(`content "${manifest.content}" não encontrado`);
  }

  // type: script precisa de entrypoint + runtime.
  if (manifest.type === "script") {
    if (!manifest.entrypoint) error("type: script exige entrypoint");
    else if (!(await exists(join(dir, manifest.entrypoint))))
      error(`entrypoint "${manifest.entrypoint}" não encontrado`);
    if (!manifest.runtime) warn("type: script deveria declarar runtime");
  }

  // Overrides em targets/ devem corresponder a alvos conhecidos.
  const targetsDir = join(dir, "targets");
  if (await exists(targetsDir)) {
    const valid = new Set<string>(TargetSchema.options);
    for (const f of await readdir(targetsDir)) {
      if (!f.endsWith(".md")) continue;
      const id = f.replace(/\.md$/, "");
      if (!valid.has(id)) warn(`targets/${f}: "${id}" não é um alvo conhecido`);
    }
  }

  // eval/cases.yaml, se presente, deve ser válido.
  if (await exists(join(dir, EVAL_FILE))) {
    try {
      parseEvalFile(await readFile(join(dir, EVAL_FILE), "utf8"));
    } catch (err) {
      error((err as Error).message);
    }
  }

  // Recomendações de robustez.
  if (!(await exists(join(dir, "README.md")))) warn("sem README.md");
  if (!(await exists(join(dir, "CHANGELOG.md")))) warn("sem CHANGELOG.md");
  if (manifest.status === "deprecated")
    warn("status: deprecated — considere remover do catálogo");
  if (manifest.status === "experimental")
    warn("status: experimental — não recomendada como padrão do time");

  return issues;
}

/** Faz lint de todas as skills sob `skillsRoot` (ex.: ./skills). */
export async function lintAll(skillsRoot: string): Promise<LintIssue[]> {
  if (!(await exists(skillsRoot))) return [];
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => join(skillsRoot, e.name));
  const all = await Promise.all(dirs.map((d) => lintSkill(d)));
  return all.flat();
}

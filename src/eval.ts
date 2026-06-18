import { z } from "zod";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import { exists } from "./adapters/shared.js";
import type { Manifest } from "./manifest.js";

const execFileAsync = promisify(execFile);

/**
 * Caso de eval: prova que a skill produz o resultado esperado.
 * - script: `args` são passados ao entrypoint; `expect_contains` checa o stdout.
 * - prompt/instruction: `input` + `expect_contains` descrevem o comportamento
 *   esperado (execução real requer provider de IA — fase futura).
 */
const EvalCaseSchema = z.object({
  name: z.string().min(1),
  input: z.string().optional(),
  args: z.array(z.string()).default([]),
  expect_contains: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .default([]),
});

export const EvalFileSchema = z.object({
  cases: z.array(EvalCaseSchema).min(1),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;

export const EVAL_FILE = join("eval", "cases.yaml");

export interface EvalResult {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Faz parse e valida o arquivo de eval. Lança erro legível se malformado. */
export function parseEvalFile(raw: string): z.infer<typeof EvalFileSchema> {
  const result = EvalFileSchema.safeParse(parseYaml(raw));
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("\n");
    throw new Error(`eval/cases.yaml inválido:\n${issues}`);
  }
  return result.data;
}

/** Executa os casos de eval de uma skill localizada em `dir`. */
export async function runEval(
  dir: string,
  manifest: Manifest,
): Promise<EvalResult[]> {
  const file = join(dir, EVAL_FILE);
  if (!(await exists(file))) {
    return [{ name: "(sem eval)", ok: true, detail: "nenhum eval definido" }];
  }
  const { cases } = parseEvalFile(await readFile(file, "utf8"));

  if (manifest.type !== "script") {
    // Eval de prompt/instruction requer um provider de IA para rodar de fato.
    // Aqui validamos a estrutura e marcamos como "pendente de execução".
    return cases.map((c) => ({
      name: c.name,
      ok: true,
      detail: "estrutura válida — execução de prompt requer provider de IA",
    }));
  }

  if (!manifest.entrypoint) {
    return [{ name: "(script)", ok: false, detail: "entrypoint não definido" }];
  }

  const results: EvalResult[] = [];
  for (const c of cases) {
    try {
      const { stdout } = await runScript(dir, manifest, c.args);
      const missing = c.expect_contains.filter((s) => !stdout.includes(s));
      results.push(
        missing.length === 0
          ? { name: c.name, ok: true }
          : { name: c.name, ok: false, detail: `faltou no stdout: ${missing.join(", ")}` },
      );
    } catch (err) {
      results.push({ name: c.name, ok: false, detail: (err as Error).message });
    }
  }
  return results;
}

async function runScript(dir: string, manifest: Manifest, args: string[]) {
  const entry = join(dir, manifest.entrypoint!);
  if (manifest.runtime === "shell") {
    return execFileAsync("sh", [entry, ...args], { cwd: dir });
  }
  return execFileAsync("node", [entry, ...args], { cwd: dir });
}

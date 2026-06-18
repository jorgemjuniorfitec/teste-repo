import { z } from "zod";
import { parse as parseYaml } from "yaml";

/**
 * Schema do `skill.yaml`. O conteúdo da skill é neutro (independente de
 * ferramenta); os `targets` declaram quais adapters sabem instalá-la.
 */
export const SkillTypeSchema = z.enum([
  "instruction",
  "prompt",
  "command",
  "script",
  "template",
]);
export type SkillType = z.infer<typeof SkillTypeSchema>;

export const TargetSchema = z.enum([
  "claude",
  "copilot",
  "cursor",
  "vscode",
  "jetbrains",
  "generic",
]);
export type Target = z.infer<typeof TargetSchema>;

export const ManifestSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "use kebab-case (ex.: commit-conventions)"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "use semver (ex.: 1.0.0)"),
  description: z.string().min(1),
  author: z.string().min(1),
  tags: z.array(z.string()).default([]),
  type: SkillTypeSchema,
  /** Arquivo-fonte neutro do conteúdo (relativo à pasta da skill). */
  content: z.string().default("content.md"),
  /** Para type: script — arquivo executado por `skills run`. */
  entrypoint: z.string().optional(),
  /** Para type: script — runtime do entrypoint. */
  runtime: z.enum(["node", "shell", "none"]).optional(),
  /** Adapters que sabem instalar esta skill. "all" expande para todos. */
  targets: z
    .union([z.literal("all"), z.array(TargetSchema)])
    .default("all"),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/** Faz parse e valida um `skill.yaml`. Lança erro legível em caso de falha. */
export function parseManifest(raw: string): Manifest {
  const data = parseYaml(raw);
  const result = ManifestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("\n");
    throw new Error(`skill.yaml inválido:\n${issues}`);
  }
  return result.data;
}

/** Resolve a lista de targets, expandindo "all" para todos os conhecidos. */
export function resolveTargets(manifest: Manifest): Target[] {
  if (manifest.targets === "all") {
    return TargetSchema.options;
  }
  return manifest.targets;
}

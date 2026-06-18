import { z } from "zod";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * Schema do `skill.yaml`. O conteúdo da skill é neutro (independente de
 * ferramenta); os `targets` declaram quais adapters sabem instalá-la, e a pasta
 * opcional `targets/` permite sobrescrever o conteúdo por ferramenta.
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

export const StatusSchema = z.enum([
  "experimental",
  "beta",
  "stable",
  "deprecated",
]);
export type Status = z.infer<typeof StatusSchema>;

/** Governança: quem mantém a skill (a pergunta nº1 quando algo quebra). */
const OwnersSchema = z.object({
  team: z.string().min(1),
  contact: z.string().min(1),
});

/** Dependências que a skill precisa para funcionar. */
const RequiresSchema = z
  .object({
    tools: z.array(z.string()).default([]),
    env: z.array(z.string()).default([]),
    mcp: z.array(z.string()).default([]),
  })
  .default({ tools: [], env: [], mcp: [] });

/** Parâmetros de skills do tipo template/prompt. */
const VariableSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  description: z.string().optional(),
  required: z.boolean().default(false),
  default: z.string().optional(),
});

export const ManifestSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "use kebab-case (ex.: commit-conventions)"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "use semver (ex.: 1.0.0)"),
  description: z.string().min(1),
  type: SkillTypeSchema,
  /** Arquivo-fonte neutro do conteúdo (relativo à pasta da skill). */
  content: z.string().default("content.md"),

  // --- Confiança / governança ---
  status: StatusSchema.default("experimental"),
  owners: OwnersSchema,
  category: z.string().optional(),
  author: z.string().optional(),

  // --- Discovery ---
  tags: z.array(z.string()).default([]),

  // --- Compatibilidade / instalação ---
  /** Adapters que sabem instalar esta skill. "all" expande para todos. */
  targets: z.union([z.literal("all"), z.array(TargetSchema)]).default("all"),
  scope: z.enum(["project", "global"]).default("project"),

  // --- Dependências e parâmetros ---
  requires: RequiresSchema,
  variables: z.array(VariableSchema).default([]),

  // --- Para type: script ---
  entrypoint: z.string().optional(),
  runtime: z.enum(["node", "shell", "none"]).optional(),
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

/** Caminho (relativo à pasta da skill) de um override de conteúdo por ferramenta. */
export function targetOverridePath(target: Target): string {
  return join("targets", `${target}.md`);
}

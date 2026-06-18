import { adapters } from "./adapters/index.js";
import type { Target } from "./manifest.js";

export interface DetectedTool {
  id: Target;
  label: string;
  present: boolean;
}

/**
 * Detecta quais ferramentas/IDEs parecem presentes em `rootDir`. O adapter
 * `generic` é sempre "presente" (fallback), mas o marcamos à parte para não
 * poluir o output do `doctor`.
 */
export async function detectTools(rootDir: string): Promise<DetectedTool[]> {
  const results = await Promise.all(
    adapters.map(async (a) => ({
      id: a.id,
      label: a.label,
      present: await a.detect(rootDir),
    })),
  );
  return results;
}

/** Apenas os alvos realmente detectados, excluindo o fallback genérico. */
export async function detectedTargets(rootDir: string): Promise<Target[]> {
  const tools = await detectTools(rootDir);
  return tools
    .filter((t) => t.present && t.id !== "generic")
    .map((t) => t.id);
}

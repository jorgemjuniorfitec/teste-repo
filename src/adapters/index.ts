import type { Adapter } from "./types.js";
import type { Target } from "../manifest.js";
import { claudeAdapter } from "./claude.js";
import { copilotAdapter } from "./copilot.js";
import { genericAdapter } from "./generic.js";

/**
 * Registro de adapters disponíveis. v1: claude, copilot, generic.
 * v2 adicionará cursor, vscode, jetbrains — basta importar aqui.
 */
export const adapters: Adapter[] = [claudeAdapter, copilotAdapter, genericAdapter];

export function getAdapter(id: Target): Adapter | undefined {
  return adapters.find((a) => a.id === id);
}

export type { Adapter };

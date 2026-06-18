import { join } from "node:path";
import { rm } from "node:fs/promises";
import type { Adapter, AppliedChange, InstallContext } from "./types.js";
import { writeFileEnsured } from "./shared.js";

/**
 * Adapter de fallback: serve qualquer ferramenta/IDE não coberta por um adapter
 * dedicado. Copia o conteúdo para `.skills/<name>.md` e imprime como usar.
 */
export const genericAdapter: Adapter = {
  id: "generic",
  label: "Genérico (qualquer ferramenta)",
  supports: ["instruction", "prompt", "command", "template"],

  // Sempre "detectável": é o último recurso.
  async detect() {
    return true;
  },

  async apply(ctx: InstallContext): Promise<AppliedChange> {
    const { manifest, content, rootDir } = ctx;
    const rel = join(".skills", `${manifest.name}.md`);
    await writeFileEnsured(join(rootDir, rel), content);
    return {
      target: "generic",
      files: [rel],
      hint: `Conteúdo salvo em ${rel} — cole na sua ferramenta de IA conforme necessário.`,
    };
  },

  async remove(ctx: InstallContext) {
    await rm(join(ctx.rootDir, ".skills", `${ctx.manifest.name}.md`), {
      force: true,
    });
  },
};

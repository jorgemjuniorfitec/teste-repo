import { join } from "node:path";
import { rm } from "node:fs/promises";
import type { Adapter, AppliedChange, InstallContext } from "./types.js";
import {
  exists,
  removeManagedBlock,
  upsertManagedBlock,
  writeFileEnsured,
} from "./shared.js";

/**
 * Adapter do GitHub Copilot.
 * - instruction      -> bloco gerenciado em .github/copilot-instructions.md
 * - command/prompt   -> .github/prompts/<name>.prompt.md
 */
export const copilotAdapter: Adapter = {
  id: "copilot",
  label: "GitHub Copilot",
  supports: ["instruction", "command", "prompt"],

  async detect(rootDir) {
    return (
      (await exists(join(rootDir, ".github", "copilot-instructions.md"))) ||
      (await exists(join(rootDir, ".github", "prompts"))) ||
      (await exists(join(rootDir, ".github")))
    );
  },

  async apply(ctx: InstallContext): Promise<AppliedChange> {
    const { manifest, content, rootDir } = ctx;
    const name = manifest.name;

    if (manifest.type === "instruction") {
      const rel = join(".github", "copilot-instructions.md");
      await upsertManagedBlock(join(rootDir, rel), name, content);
      return { target: "copilot", files: [rel] };
    }

    const rel = join(".github", "prompts", `${name}.prompt.md`);
    await writeFileEnsured(join(rootDir, rel), content);
    return {
      target: "copilot",
      files: [rel],
      hint: `Prompt do Copilot disponível em ${rel}`,
    };
  },

  async remove(ctx: InstallContext) {
    const { manifest, rootDir } = ctx;
    const name = manifest.name;
    if (manifest.type === "instruction") {
      await removeManagedBlock(
        join(rootDir, ".github", "copilot-instructions.md"),
        name,
      );
      return;
    }
    await rm(join(rootDir, ".github", "prompts", `${name}.prompt.md`), {
      force: true,
    });
  },
};

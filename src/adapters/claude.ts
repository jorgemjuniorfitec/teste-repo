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
 * Adapter do Claude / Claude Code.
 * - instruction  -> bloco gerenciado em CLAUDE.md
 * - command      -> .claude/commands/<name>.md
 * - prompt       -> .claude/skills/<name>.md
 */
export const claudeAdapter: Adapter = {
  id: "claude",
  label: "Claude / Claude Code",
  supports: ["instruction", "command", "prompt"],

  async detect(rootDir) {
    return (
      (await exists(join(rootDir, ".claude"))) ||
      (await exists(join(rootDir, "CLAUDE.md")))
    );
  },

  async apply(ctx: InstallContext): Promise<AppliedChange> {
    const { manifest, content, rootDir } = ctx;
    const name = manifest.name;

    if (manifest.type === "instruction") {
      const file = join(rootDir, "CLAUDE.md");
      await upsertManagedBlock(file, name, content);
      return { target: "claude", files: ["CLAUDE.md"] };
    }

    const rel =
      manifest.type === "command"
        ? join(".claude", "commands", `${name}.md`)
        : join(".claude", "skills", `${name}.md`);
    await writeFileEnsured(join(rootDir, rel), content);
    return {
      target: "claude",
      files: [rel],
      hint:
        manifest.type === "command"
          ? `Use no Claude Code com: /${name}`
          : `Disponível como skill em .claude/skills/${name}.md`,
    };
  },

  async remove(ctx: InstallContext) {
    const { manifest, rootDir } = ctx;
    const name = manifest.name;
    if (manifest.type === "instruction") {
      await removeManagedBlock(join(rootDir, "CLAUDE.md"), name);
      return;
    }
    const rel =
      manifest.type === "command"
        ? join(".claude", "commands", `${name}.md`)
        : join(".claude", "skills", `${name}.md`);
    await rm(join(rootDir, rel), { force: true });
  },
};

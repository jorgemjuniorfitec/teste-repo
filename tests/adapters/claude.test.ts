import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAdapter } from "../../src/adapters/claude.js";
import type { InstallContext } from "../../src/adapters/types.js";
import type { Manifest } from "../../src/manifest.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skills-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function ctx(type: Manifest["type"], name = "demo"): InstallContext {
  return {
    manifest: {
      name,
      version: "1.0.0",
      description: "d",
      type,
      content: "content.md",
      status: "stable",
      owners: { team: "t", contact: "c" },
      tags: [],
      targets: "all",
      scope: "project",
      requires: { tools: [], env: [], mcp: [] },
      variables: [],
    },
    content: "conteudo da skill",
    sourceDir: "",
    rootDir: root,
    scope: "project",
  };
}

describe("claudeAdapter", () => {
  it("instruction grava bloco gerenciado em CLAUDE.md", async () => {
    await claudeAdapter.apply(ctx("instruction"));
    const md = await readFile(join(root, "CLAUDE.md"), "utf8");
    expect(md).toContain("skills:begin demo");
    expect(md).toContain("conteudo da skill");
  });

  it("remove apaga o bloco gerenciado", async () => {
    await claudeAdapter.apply(ctx("instruction"));
    await claudeAdapter.remove(ctx("instruction"));
    const md = await readFile(join(root, "CLAUDE.md"), "utf8");
    expect(md).not.toContain("conteudo da skill");
  });

  it("command grava em .claude/commands", async () => {
    const change = await claudeAdapter.apply(ctx("command", "deploy"));
    expect(change.files[0]).toContain(join(".claude", "commands", "deploy.md"));
  });
});

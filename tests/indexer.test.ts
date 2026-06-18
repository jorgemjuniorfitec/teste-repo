import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex, writeIndex, checkIndexInSync } from "../src/indexer.js";
import { newSkill } from "../src/generator.js";

let base: string;
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "skills-index-"));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("indexer", () => {
  it("constrói o índice a partir das skills", async () => {
    await newSkill({ name: "a", type: "instruction", baseDir: base });
    await newSkill({ name: "b", type: "prompt", baseDir: base });
    const index = await buildIndex(base);
    expect(index.skills.map((s) => s.name)).toEqual(["a", "b"]);
    expect(index.skills[0].path).toBe(`${join(base).split("/").pop()}/a`);
  });

  it("--check passa quando o índice está em dia", async () => {
    await newSkill({ name: "a", type: "instruction", baseDir: base });
    const out = join(base, "..", `idx-${Date.now()}.json`);
    await writeIndex(base, out);
    expect((await checkIndexInSync(base, out)).inSync).toBe(true);
    await rm(out, { force: true });
  });

  it("--check falha quando o índice está desatualizado", async () => {
    await newSkill({ name: "a", type: "instruction", baseDir: base });
    const out = join(base, "..", `idx-${Date.now()}.json`);
    await writeFile(out, JSON.stringify({ updated_at: "x", skills: [] }));
    const result = await checkIndexInSync(base, out);
    expect(result.inSync).toBe(false);
    await rm(out, { force: true });
  });
});

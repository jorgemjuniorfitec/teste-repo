import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintSkill } from "../src/lint.js";
import { newSkill } from "../src/generator.js";
import { writeFileEnsured } from "../src/adapters/shared.js";

let base: string;
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "skills-lint-"));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("lintSkill", () => {
  it("aponta erro quando o name difere da pasta", async () => {
    const dir = join(base, "errada");
    await writeFileEnsured(
      join(dir, "skill.yaml"),
      `name: outra\nversion: 1.0.0\ndescription: d\ntype: prompt\nowners: { team: t, contact: c }\n`,
    );
    await writeFileEnsured(join(dir, "content.md"), "x");
    const issues = await lintSkill(dir);
    expect(issues.some((i) => i.level === "error" && /difere/.test(i.message))).toBe(true);
  });

  it("erro quando content referenciado não existe", async () => {
    const dir = join(base, "semconteudo");
    await writeFileEnsured(
      join(dir, "skill.yaml"),
      `name: semconteudo\nversion: 1.0.0\ndescription: d\ntype: prompt\nowners: { team: t, contact: c }\n`,
    );
    const issues = await lintSkill(dir);
    expect(issues.some((i) => i.level === "error" && /content/.test(i.message))).toBe(true);
  });

  it("skill gerada pelo `new` passa sem erros (só avisos)", async () => {
    const dir = await newSkill({ name: "minha-skill", type: "instruction", baseDir: base });
    const issues = await lintSkill(dir);
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  parseManifest,
  resolveTargets,
  targetOverridePath,
} from "../src/manifest.js";

const VALID = `
name: commit-conventions
version: 1.0.0
description: padrao
type: instruction
status: stable
owners:
  team: plataforma
  contact: "#guilda-dev"
targets: all
`;

describe("parseManifest", () => {
  it("faz parse de um manifesto válido e aplica defaults", () => {
    const m = parseManifest(VALID);
    expect(m.name).toBe("commit-conventions");
    expect(m.content).toBe("content.md");
    expect(m.scope).toBe("project");
    expect(m.requires.tools).toEqual([]);
    expect(resolveTargets(m)).toContain("claude");
    expect(resolveTargets(m)).toContain("copilot");
  });

  it("exige owners (governança)", () => {
    expect(() =>
      parseManifest(`
name: x
version: 1.0.0
description: x
type: prompt
`),
    ).toThrow(/skill.yaml inválido/);
  });

  it("rejeita nome fora de kebab-case", () => {
    expect(() =>
      parseManifest(`
name: Commit_Conventions
version: 1.0.0
description: x
type: prompt
owners: { team: t, contact: c }
`),
    ).toThrow(/skill.yaml inválido/);
  });

  it("resolve lista explícita de targets", () => {
    const m = parseManifest(`
name: x
version: 1.0.0
description: x
type: instruction
owners: { team: t, contact: c }
targets: [claude, copilot]
`);
    expect(resolveTargets(m)).toEqual(["claude", "copilot"]);
  });

  it("targetOverridePath aponta para targets/<id>.md", () => {
    expect(targetOverridePath("copilot")).toContain("copilot.md");
  });
});

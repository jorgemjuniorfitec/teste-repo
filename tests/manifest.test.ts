import { describe, it, expect } from "vitest";
import { parseManifest, resolveTargets } from "../src/manifest.js";

describe("parseManifest", () => {
  it("faz parse de um manifesto válido", () => {
    const m = parseManifest(`
name: commit-conventions
version: 1.0.0
description: padrao
author: jorge@empresa.com
type: instruction
targets: all
`);
    expect(m.name).toBe("commit-conventions");
    expect(m.content).toBe("content.md");
    expect(resolveTargets(m)).toContain("claude");
    expect(resolveTargets(m)).toContain("copilot");
  });

  it("rejeita nome fora de kebab-case", () => {
    expect(() =>
      parseManifest(`
name: Commit_Conventions
version: 1.0.0
description: x
author: y
type: prompt
`),
    ).toThrow(/skill.yaml inválido/);
  });

  it("rejeita versão não-semver", () => {
    expect(() =>
      parseManifest(`
name: x
version: "1"
description: x
author: y
type: prompt
`),
    ).toThrow();
  });

  it("resolve lista explícita de targets", () => {
    const m = parseManifest(`
name: x
version: 1.0.0
description: x
author: y
type: instruction
targets: [claude, copilot]
`);
    expect(resolveTargets(m)).toEqual(["claude", "copilot"]);
  });
});

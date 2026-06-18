import { join, basename } from "node:path";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { parseManifest } from "./manifest.js";
import { exists } from "./adapters/shared.js";
import type { IndexEntry, MarketplaceIndex } from "./registry.js";

/**
 * Gera o index.json a partir das pastas em `skillsRoot`. O índice é derivado —
 * nunca editado à mão — e o CI exige que esteja em dia (ver `--check`).
 */
export async function buildIndex(skillsRoot: string): Promise<MarketplaceIndex> {
  const entries: IndexEntry[] = [];

  if (await exists(skillsRoot)) {
    const dirents = await readdir(skillsRoot, { withFileTypes: true });
    const dirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const name of dirs) {
      const dir = join(skillsRoot, name);
      const manifestPath = join(dir, "skill.yaml");
      if (!(await exists(manifestPath))) continue;
      const m = parseManifest(await readFile(manifestPath, "utf8"));
      entries.push({
        name: m.name,
        version: m.version,
        description: m.description,
        type: m.type,
        status: m.status,
        category: m.category,
        tags: m.tags,
        path: `${basename(skillsRoot)}/${name}`,
      });
    }
  }

  return { updated_at: new Date().toISOString(), skills: entries };
}

/** Serializa o índice de forma estável (campo updated_at à parte para o --check). */
export function serializeIndex(index: MarketplaceIndex): string {
  return JSON.stringify(index, null, 2) + "\n";
}

export async function writeIndex(
  skillsRoot: string,
  indexPath: string,
): Promise<MarketplaceIndex> {
  const index = await buildIndex(skillsRoot);
  await writeFile(indexPath, serializeIndex(index), "utf8");
  return index;
}

/**
 * Verifica se o index.json commitado bate com o gerado a partir das skills,
 * ignorando `updated_at`. Usado no CI para barrar PRs com índice desatualizado.
 */
export async function checkIndexInSync(
  skillsRoot: string,
  indexPath: string,
): Promise<{ inSync: boolean; reason?: string }> {
  const generated = await buildIndex(skillsRoot);
  if (!(await exists(indexPath))) {
    return { inSync: false, reason: "index.json não existe" };
  }
  const committed = JSON.parse(await readFile(indexPath, "utf8")) as MarketplaceIndex;
  const norm = (i: MarketplaceIndex) => JSON.stringify(i.skills);
  if (norm(generated) !== norm(committed)) {
    return { inSync: false, reason: "index.json não reflete as skills atuais" };
  }
  return { inSync: true };
}

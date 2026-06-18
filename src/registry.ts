import { join } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { simpleGit } from "simple-git";
import { CACHE_DIR, loadConfig } from "./config.js";
import { parseManifest, type Manifest } from "./manifest.js";
import { exists } from "./adapters/shared.js";

/** Entrada da skill no index.json do marketplace. */
export interface IndexEntry {
  name: string;
  version: string;
  description: string;
  type: string;
  status: string;
  category?: string;
  tags: string[];
  path: string;
}

export interface MarketplaceIndex {
  updated_at: string;
  skills: IndexEntry[];
}

/** Clona (ou atualiza) o repositório do marketplace no cache local. */
export async function syncRepo(): Promise<void> {
  const config = await loadConfig();
  if (!config.repoUrl) {
    throw new Error('Marketplace não configurado. Rode "skills init <url-git>".');
  }

  if (await exists(join(CACHE_DIR, ".git"))) {
    await simpleGit(CACHE_DIR).pull("origin", config.branch);
  } else {
    await rm(CACHE_DIR, { recursive: true, force: true });
    await simpleGit().clone(config.repoUrl, CACHE_DIR, [
      "--branch",
      config.branch,
      "--depth",
      "1",
    ]);
  }
}

export async function readIndex(): Promise<MarketplaceIndex> {
  const indexPath = join(CACHE_DIR, "index.json");
  if (!(await exists(indexPath))) {
    throw new Error('Índice não encontrado. Rode "skills update" primeiro.');
  }
  return JSON.parse(await readFile(indexPath, "utf8")) as MarketplaceIndex;
}

export async function searchIndex(term: string): Promise<IndexEntry[]> {
  const { skills } = await readIndex();
  const q = term.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export async function findEntry(name: string): Promise<IndexEntry | undefined> {
  const { skills } = await readIndex();
  return skills.find((s) => s.name === name);
}

/** Carrega o manifesto de uma skill a partir do cache local. */
export async function loadSkillManifest(
  entry: IndexEntry,
): Promise<{ manifest: Manifest; sourceDir: string }> {
  const sourceDir = join(CACHE_DIR, entry.path);
  const raw = await readFile(join(sourceDir, "skill.yaml"), "utf8");
  return { manifest: parseManifest(raw), sourceDir };
}

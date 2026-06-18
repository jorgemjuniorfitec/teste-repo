import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

/** Diretório base do estado local do CLI: ~/.skills */
export const SKILLS_HOME = process.env.SKILLS_HOME ?? join(homedir(), ".skills");
export const CONFIG_PATH = join(SKILLS_HOME, "config.json");
/** Clone local do repositório do marketplace. */
export const CACHE_DIR = join(SKILLS_HOME, "cache");
/** Registro das skills instaladas (para update/remove). */
export const INSTALLED_DIR = join(SKILLS_HOME, "installed");

export interface Config {
  /** URL Git do repositório que serve de marketplace. */
  repoUrl?: string;
  /** Branch usada no marketplace (default: main). */
  branch: string;
}

const DEFAULT_CONFIG: Config = { branch: "main" };

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(SKILLS_HOME, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

import { join } from "node:path";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { INSTALLED_DIR } from "./config.js";
import { getAdapter } from "./adapters/index.js";
import type { AppliedChange, InstallContext } from "./adapters/types.js";
import { resolveTargets, type Manifest, type Target } from "./manifest.js";
import { exists } from "./adapters/shared.js";

/** Registro persistido de uma instalação, para `update`/`remove`. */
export interface InstallRecord {
  name: string;
  version: string;
  scope: "project" | "global";
  rootDir: string;
  targets: Target[];
  changes: AppliedChange[];
  installedAt: string;
}

export interface InstallOptions {
  manifest: Manifest;
  sourceDir: string;
  rootDir: string;
  scope: "project" | "global";
  /** Alvos escolhidos pelo usuário (já resolvidos pela CLI). */
  targets: Target[];
}

/** Quais alvos (dos declarados na skill) um dado adapter consegue atender. */
export function compatibleTargets(manifest: Manifest, candidates: Target[]): Target[] {
  const declared = new Set(resolveTargets(manifest));
  return candidates.filter((t) => {
    if (!declared.has(t)) return false;
    const adapter = getAdapter(t);
    return adapter?.supports.includes(manifest.type) ?? false;
  });
}

export async function installSkill(opts: InstallOptions): Promise<InstallRecord> {
  const { manifest, sourceDir, rootDir, scope, targets } = opts;
  const content = await readFile(join(sourceDir, manifest.content), "utf8");

  const ctx: InstallContext = { manifest, content, sourceDir, rootDir, scope };
  const changes: AppliedChange[] = [];

  for (const target of targets) {
    const adapter = getAdapter(target);
    if (!adapter) continue;
    changes.push(await adapter.apply(ctx));
  }

  const record: InstallRecord = {
    name: manifest.name,
    version: manifest.version,
    scope,
    rootDir,
    targets,
    changes,
    installedAt: new Date().toISOString(),
  };
  await saveRecord(record);
  return record;
}

export async function uninstallSkill(name: string): Promise<boolean> {
  const record = await loadRecord(name);
  if (!record) return false;

  // Reconstrói um manifesto mínimo para os adapters removerem corretamente.
  for (const target of record.targets) {
    const adapter = getAdapter(target);
    if (!adapter) continue;
    const ctx: InstallContext = {
      manifest: { name: record.name, type: inferType(record) } as Manifest,
      content: "",
      sourceDir: "",
      rootDir: record.rootDir,
      scope: record.scope,
    };
    await adapter.remove(ctx).catch(() => void 0);
  }
  await rm(recordPath(name), { force: true });
  return true;
}

export async function listInstalled(): Promise<InstallRecord[]> {
  if (!(await exists(INSTALLED_DIR))) return [];
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(INSTALLED_DIR)).filter((f) => f.endsWith(".json"));
  const records = await Promise.all(
    files.map(async (f) =>
      JSON.parse(await readFile(join(INSTALLED_DIR, f), "utf8")) as InstallRecord,
    ),
  );
  return records;
}

function inferType(record: InstallRecord): Manifest["type"] {
  // O type não é persistido; inferimos pelos arquivos tocados para o remove.
  const files = record.changes.flatMap((c) => c.files).join(" ");
  if (files.includes("commands") || files.includes(".prompt.md")) return "command";
  if (files.includes("CLAUDE.md") || files.includes("copilot-instructions"))
    return "instruction";
  return "prompt";
}

function recordPath(name: string): string {
  return join(INSTALLED_DIR, `${name}.json`);
}

async function saveRecord(record: InstallRecord): Promise<void> {
  await mkdir(INSTALLED_DIR, { recursive: true });
  await writeFile(recordPath(record.name), JSON.stringify(record, null, 2), "utf8");
}

async function loadRecord(name: string): Promise<InstallRecord | undefined> {
  if (!(await exists(recordPath(name)))) return undefined;
  return JSON.parse(await readFile(recordPath(name), "utf8")) as InstallRecord;
}

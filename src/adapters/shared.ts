import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname } from "node:path";

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileEnsured(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

const BEGIN = (name: string) => `<!-- skills:begin ${name} -->`;
const END = (name: string) => `<!-- skills:end ${name} -->`;

/**
 * Insere/atualiza um bloco "gerenciado" delimitado por marcadores dentro de um
 * arquivo de instruções (ex.: CLAUDE.md, copilot-instructions.md). Isso permite
 * conviver com conteúdo escrito por humanos e remover a skill depois sem dano.
 */
export async function upsertManagedBlock(
  path: string,
  skillName: string,
  body: string,
): Promise<void> {
  const block = `${BEGIN(skillName)}\n${body.trim()}\n${END(skillName)}`;
  let current = (await exists(path)) ? await readFile(path, "utf8") : "";

  const re = new RegExp(
    `${escapeRe(BEGIN(skillName))}[\\s\\S]*?${escapeRe(END(skillName))}`,
  );
  if (re.test(current)) {
    current = current.replace(re, block);
  } else {
    current = current.trimEnd() + (current ? "\n\n" : "") + block + "\n";
  }
  await writeFileEnsured(path, current);
}

/** Remove um bloco gerenciado de um arquivo de instruções, se existir. */
export async function removeManagedBlock(
  path: string,
  skillName: string,
): Promise<void> {
  if (!(await exists(path))) return;
  const current = await readFile(path, "utf8");
  const re = new RegExp(
    `\\n*${escapeRe(BEGIN(skillName))}[\\s\\S]*?${escapeRe(END(skillName))}\\n*`,
  );
  const next = current.replace(re, "\n");
  await writeFile(path, next, "utf8");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

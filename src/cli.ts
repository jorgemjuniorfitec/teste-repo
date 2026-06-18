import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { checkbox, confirm } from "@inquirer/prompts";
import { saveConfig } from "./config.js";
import {
  findEntry,
  loadSkillManifest,
  searchIndex,
  syncRepo,
} from "./registry.js";
import { detectTools, detectedTargets } from "./detect.js";
import {
  compatibleTargets,
  installSkill,
  listInstalled,
  uninstallSkill,
} from "./installer.js";
import { resolveTargets, type Target } from "./manifest.js";
import { getAdapter } from "./adapters/index.js";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("skills")
    .description("Marketplace interno de skills de IA")
    .version("0.1.0");

  program
    .command("init")
    .argument("<repoUrl>", "URL Git do repositório do marketplace")
    .option("-b, --branch <branch>", "branch do marketplace", "main")
    .description("configura o repositório do marketplace")
    .action(async (repoUrl: string, opts: { branch: string }) => {
      await saveConfig({ repoUrl, branch: opts.branch });
      console.log(chalk.green(`✓ Marketplace configurado: ${repoUrl}`));
      console.log(chalk.dim('Rode "skills update" para baixar o catálogo.'));
    });

  program
    .command("update")
    .description("atualiza o catálogo local (git pull)")
    .action(async () => {
      const spinner = ora("Sincronizando catálogo...").start();
      try {
        await syncRepo();
        spinner.succeed("Catálogo atualizado.");
      } catch (err) {
        spinner.fail((err as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command("search")
    .argument("<termo>", "texto a buscar (nome, descrição ou tag)")
    .description("busca skills no catálogo")
    .action(async (termo: string) => {
      const results = await searchIndex(termo);
      if (results.length === 0) {
        console.log(chalk.yellow("Nenhuma skill encontrada."));
        return;
      }
      for (const s of results) {
        console.log(
          `${chalk.bold(s.name)} ${chalk.dim(`v${s.version}`)}  ${s.description}`,
        );
        if (s.tags.length) console.log(chalk.dim(`  tags: ${s.tags.join(", ")}`));
      }
    });

  program
    .command("info")
    .argument("<nome>", "nome da skill")
    .description("mostra detalhes de uma skill")
    .action(async (nome: string) => {
      const entry = await findEntry(nome);
      if (!entry) return notFound(nome);
      const { manifest } = await loadSkillManifest(entry);
      console.log(chalk.bold(manifest.name), chalk.dim(`v${manifest.version}`));
      console.log(manifest.description);
      console.log(chalk.dim(`autor: ${manifest.author}`));
      console.log(chalk.dim(`tipo: ${manifest.type}`));
      console.log(chalk.dim(`alvos: ${resolveTargets(manifest).join(", ")}`));
    });

  program
    .command("doctor")
    .description("detecta ferramentas de IA / IDEs no diretório atual")
    .action(async () => {
      const tools = await detectTools(process.cwd());
      console.log(chalk.bold("Ambiente detectado:"));
      for (const t of tools) {
        if (t.id === "generic") continue;
        const mark = t.present ? chalk.green("✓") : chalk.dim("·");
        console.log(`  ${mark} ${t.label}`);
      }
    });

  program
    .command("install")
    .argument("<nome>", "nome da skill")
    .option("-t, --target <alvos>", "alvos separados por vírgula (ex.: claude,copilot)")
    .option("-a, --all", "instala em todos os alvos detectados")
    .option("-g, --global", "instala na config do usuário, não no projeto")
    .option("-y, --yes", "não-interativo (assume os alvos detectados)")
    .description("instala uma skill (assistente multi-ferramenta)")
    .action(async (nome: string, opts: InstallFlags) => {
      const entry = await findEntry(nome);
      if (!entry) return notFound(nome);
      const { manifest, sourceDir } = await loadSkillManifest(entry);
      const rootDir = opts.global
        ? process.env.HOME ?? process.cwd()
        : process.cwd();

      const chosen = await chooseTargets(manifest, opts);
      if (chosen.length === 0) {
        console.log(chalk.yellow("Nenhum alvo selecionado. Nada a fazer."));
        return;
      }

      const record = await installSkill({
        manifest,
        sourceDir,
        rootDir,
        scope: opts.global ? "global" : "project",
        targets: chosen,
      });

      console.log(chalk.green(`✓ ${manifest.name} instalada.`));
      for (const change of record.changes) {
        const adapter = getAdapter(change.target);
        console.log(`  ${chalk.bold(adapter?.label ?? change.target)}:`);
        for (const f of change.files) console.log(chalk.dim(`    ${f}`));
        if (change.hint) console.log(chalk.cyan(`    → ${change.hint}`));
      }
    });

  program
    .command("list")
    .description("lista skills instaladas")
    .action(async () => {
      const installed = await listInstalled();
      if (installed.length === 0) {
        console.log(chalk.dim("Nenhuma skill instalada."));
        return;
      }
      for (const r of installed) {
        console.log(
          `${chalk.bold(r.name)} ${chalk.dim(`v${r.version}`)}  ${chalk.dim(
            `[${r.targets.join(", ")}]`,
          )}`,
        );
      }
    });

  program
    .command("remove")
    .argument("<nome>", "nome da skill")
    .description("remove uma skill instalada de todos os alvos")
    .action(async (nome: string) => {
      const ok = await uninstallSkill(nome);
      console.log(
        ok
          ? chalk.green(`✓ ${nome} removida.`)
          : chalk.yellow(`${nome} não está instalada.`),
      );
    });

  return program;
}

interface InstallFlags {
  target?: string;
  all?: boolean;
  global?: boolean;
  yes?: boolean;
}

/** Decide os alvos finais: flag explícita > --all/--yes > pergunta interativa. */
async function chooseTargets(
  manifest: Parameters<typeof resolveTargets>[0],
  opts: InstallFlags,
): Promise<Target[]> {
  const detected = await detectedTargets(process.cwd());

  if (opts.target) {
    const requested = opts.target.split(",").map((s) => s.trim()) as Target[];
    return compatibleTargets(manifest, requested);
  }

  // Alvos candidatos: interseção entre o que a skill suporta e o detectado.
  // Se nada foi detectado, caímos no genérico.
  const candidates =
    detected.length > 0
      ? compatibleTargets(manifest, detected)
      : compatibleTargets(manifest, ["generic"]);

  if (opts.all || opts.yes) {
    return candidates.length > 0 ? candidates : compatibleTargets(manifest, ["generic"]);
  }

  if (candidates.length === 0) {
    return compatibleTargets(manifest, ["generic"]);
  }

  const selected = await checkbox<Target>({
    message: `Instalar "${manifest.name}" para quais ferramentas?`,
    choices: candidates.map((t) => ({
      name: getAdapter(t)?.label ?? t,
      value: t,
      checked: true,
    })),
  });

  if (selected.length === 0) {
    const fallback = await confirm({
      message: "Nenhum selecionado. Salvar como genérico (.skills/)?",
      default: true,
    });
    return fallback ? compatibleTargets(manifest, ["generic"]) : [];
  }
  return selected;
}

function notFound(nome: string): void {
  console.log(chalk.red(`Skill "${nome}" não encontrada no catálogo.`));
  console.log(chalk.dim('Tente "skills update" ou "skills search <termo>".'));
  process.exitCode = 1;
}

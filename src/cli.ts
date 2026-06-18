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
import {
  resolveTargets,
  SkillTypeSchema,
  parseManifest,
  type SkillType,
  type Target,
} from "./manifest.js";
import { getAdapter } from "./adapters/index.js";
import { lintAll, lintSkill, type LintIssue } from "./lint.js";
import { newSkill } from "./generator.js";
import { runEval } from "./eval.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
      console.log(
        chalk.bold(manifest.name),
        chalk.dim(`v${manifest.version}`),
        statusBadge(manifest.status),
      );
      console.log(manifest.description);
      console.log(chalk.dim(`tipo: ${manifest.type}`));
      console.log(
        chalk.dim(`mantido por: ${manifest.owners.team} (${manifest.owners.contact})`),
      );
      if (manifest.category) console.log(chalk.dim(`categoria: ${manifest.category}`));
      console.log(chalk.dim(`alvos: ${resolveTargets(manifest).join(", ")}`));
      const reqs = [
        ...manifest.requires.tools.map((t) => `tool:${t}`),
        ...manifest.requires.env.map((e) => `env:${e}`),
        ...manifest.requires.mcp.map((m) => `mcp:${m}`),
      ];
      if (reqs.length) console.log(chalk.dim(`requer: ${reqs.join(", ")}`));
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

  // --- Comandos de autoria ---

  program
    .command("new")
    .argument("<nome>", "nome da skill (kebab-case)")
    .option("-t, --type <tipo>", "tipo da skill", "instruction")
    .option("-d, --dir <pasta>", "pasta base do catálogo", "skills")
    .description("cria o esqueleto de uma skill na estrutura recomendada")
    .action(async (nome: string, opts: { type: string; dir: string }) => {
      const parsedType = SkillTypeSchema.safeParse(opts.type);
      if (!parsedType.success) {
        console.log(
          chalk.red(`tipo inválido: ${opts.type}`),
          chalk.dim(`(use: ${SkillTypeSchema.options.join(", ")})`),
        );
        process.exitCode = 1;
        return;
      }
      const dir = await newSkill({
        name: nome,
        type: parsedType.data as SkillType,
        baseDir: opts.dir,
      });
      console.log(chalk.green(`✓ Skill criada em ${dir}`));
      console.log(chalk.dim("Edite skill.yaml/content.md e rode: skills lint " + dir));
    });

  program
    .command("lint")
    .argument("[dir]", "pasta de uma skill (default: faz lint de todo o catálogo)")
    .option("-d, --dir <pasta>", "pasta base do catálogo p/ --all", "skills")
    .description("valida skills (manifesto, conteúdo, overrides, eval)")
    .action(async (dir: string | undefined, opts: { dir: string }) => {
      const issues = dir ? await lintSkill(dir) : await lintAll(opts.dir);
      reportLint(issues);
    });

  program
    .command("eval")
    .argument("<dir>", "pasta da skill a avaliar")
    .description("executa os casos de eval da skill")
    .action(async (dir: string) => {
      const manifest = parseManifest(await readFile(join(dir, "skill.yaml"), "utf8"));
      const results = await runEval(dir, manifest);
      let failed = 0;
      for (const r of results) {
        const mark = r.ok ? chalk.green("✓") : chalk.red("✗");
        if (!r.ok) failed++;
        console.log(`  ${mark} ${r.name}${r.detail ? chalk.dim(` — ${r.detail}`) : ""}`);
      }
      if (failed > 0) {
        console.log(chalk.red(`${failed} caso(s) falharam.`));
        process.exitCode = 1;
      } else {
        console.log(chalk.green("Eval OK."));
      }
    });

  return program;
}

function statusBadge(status: string): string {
  switch (status) {
    case "stable":
      return chalk.green("[stable]");
    case "beta":
      return chalk.yellow("[beta]");
    case "deprecated":
      return chalk.red("[deprecated]");
    default:
      return chalk.dim("[experimental]");
  }
}

function reportLint(issues: LintIssue[]): void {
  if (issues.length === 0) {
    console.log(chalk.green("✓ Sem problemas."));
    return;
  }
  const errors = issues.filter((i) => i.level === "error");
  for (const i of issues) {
    const tag = i.level === "error" ? chalk.red("erro") : chalk.yellow("aviso");
    console.log(`  ${tag} ${chalk.bold(i.skill)}: ${i.message}`);
  }
  console.log(
    chalk.dim(
      `${errors.length} erro(s), ${issues.length - errors.length} aviso(s).`,
    ),
  );
  if (errors.length > 0) process.exitCode = 1;
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

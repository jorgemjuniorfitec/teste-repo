import type { Manifest, Target } from "../manifest.js";

/** Contexto passado para um adapter ao instalar/remover uma skill. */
export interface InstallContext {
  /** Manifesto da skill. */
  manifest: Manifest;
  /** Conteúdo neutro já lido (do arquivo `content`). */
  content: string;
  /** Diretório de origem da skill (no clone do marketplace). */
  sourceDir: string;
  /** Raiz onde instalar: o projeto atual ou o home do usuário (--global). */
  rootDir: string;
  /** Escopo da instalação. */
  scope: "project" | "global";
}

/** Resultado de uma instalação por um adapter (para log e para `remove`). */
export interface AppliedChange {
  target: Target;
  /** Arquivos criados/modificados, relativos a rootDir. */
  files: string[];
  /** Mensagem amigável a exibir ao dev após instalar. */
  hint?: string;
}

/**
 * Um Adapter sabe instalar/remover skills no formato de UMA ferramenta
 * (Claude, Copilot, Cursor...). Adicionar uma ferramenta = novo módulo,
 * sem tocar no resto do CLI.
 */
export interface Adapter {
  readonly id: Target;
  /** Nome legível (ex.: "GitHub Copilot"). */
  readonly label: string;
  /** Tipos de skill que este adapter consegue instalar. */
  readonly supports: Manifest["type"][];
  /** True se a ferramenta parece presente em `rootDir` (heurística de detecção). */
  detect(rootDir: string): Promise<boolean>;
  /** Instala a skill; retorna os arquivos tocados. */
  apply(ctx: InstallContext): Promise<AppliedChange>;
  /** Remove a skill previamente instalada (best-effort). */
  remove(ctx: InstallContext): Promise<void>;
}

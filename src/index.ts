#!/usr/bin/env node
import { buildProgram } from "./cli.js";

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

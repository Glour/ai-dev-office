#!/usr/bin/env node
import { runCli } from "../src/runner.mjs";

runCli().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

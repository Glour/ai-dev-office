#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { loadPlaywright } from "../src/runner.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const agentRoot = resolve(here, "..");

function parseArgs(argv) {
  const out = {
    url: process.env.QA_BASE_URL || process.env.XONE_QA_BASE_URL || "https://ai-officexone.com",
    out: process.env.QA_STORAGE_STATE || process.env.XONE_QA_STORAGE_STATE || resolve(agentRoot, "storage-state.json")
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") out.url = argv[++index] || out.url;
    else if (arg === "--out") out.out = resolve(argv[++index] || out.out);
    else if (!arg.startsWith("-")) out.url = arg;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const { chromium } = loadPlaywright();
mkdirSync(dirname(args.out), { recursive: true });

console.log(`Opening: ${args.url}`);
console.log(`Storage will be saved to: ${args.out}`);
console.log("Log in manually in the opened browser, then press Enter here.");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.goto(args.url, { waitUntil: "domcontentloaded" });

const rl = createInterface({ input, output });
await rl.question("Press Enter after login is complete...");
rl.close();

await context.storageState({ path: args.out });
await browser.close();
console.log(`Saved storage state: ${args.out}`);

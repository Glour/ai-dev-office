import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const agentRoot = resolve(here, "..");
const require = createRequire(import.meta.url);
const defaultConfigPath = resolve(agentRoot, "configs/example-site.json");
const builtInChecks = [
  "expected-text",
  "forbidden-text",
  "console-clean",
  "pageerror-clean",
  "no-page-overflow",
  "no-visible-overlap",
  "form-controls-visible",
  "inputs-have-labels",
  "buttons-have-names",
  "textarea-resizable",
  "broken-images",
  "info-tooltips",
  "tabs-open",
  "actions-work",
  "selects-readable",
  "table-has-rows",
  "custom-text-regex",
  "http-status-ok",
  "network-clean",
  "basic-seo",
  "landmarks",
  "aria-smoke",
  "clickables-enabled",
  "focus-visible",
  "links-valid",
  "performance-budget"
];

function parseArgs(argv) {
  const out = { configPath: "", baseUrl: "", headed: false, strict: true, listChecks: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--list-checks") out.listChecks = true;
    else if (arg === "--headed") out.headed = true;
    else if (arg === "--no-strict") out.strict = false;
    else if (arg === "--base-url") out.baseUrl = argv[++index] || "";
    else if (arg === "--config") out.configPath = argv[++index] || "";
    else if (!arg.startsWith("-") && !out.configPath) out.configPath = arg;
  }
  return out;
}

function usage() {
  return `
Universal QA Agent

Usage:
  node ./bin/universal-qa.mjs ./configs/example-site.json
  node ./bin/universal-qa.mjs --config ./configs/xone-prod-agent-card.json --base-url https://ai-officexone.com

Options:
  --base-url <url>   Override config baseUrl
  --headed           Open visible browser
  --no-strict        Do not exit non-zero on FAIL
  --list-checks      Print built-in check names
`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function safeId(value) {
  return String(value || "page").replace(/[^a-z0-9а-яё_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "page";
}

function nowId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function markdownLink(label, absolutePath) {
  return `[${label}](${absolutePath})`;
}

function issue(check, severity, details) {
  return { check, severity, details };
}

function issueWithSeverity(check, severity, details) {
  return issue(check, severity || "fail", details);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactList(values, max = 8) {
  const list = values.slice(0, max);
  const suffix = values.length > max ? `; +${values.length - max} more` : "";
  return `${list.join("; ")}${suffix}`;
}

function matchesAny(value, patterns = []) {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return value.includes(String(pattern));
    }
  });
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function resolveMaybe(base, value) {
  if (!value) return "";
  return isAbsolute(value) ? value : resolve(base, value);
}

function makeArtifactRoot(config, configPath) {
  const configured = config.artifactDir || "artifacts/universal-qa";
  const root = resolveMaybe(dirname(configPath), configured);
  const runRoot = join(root, nowId());
  mkdirSync(join(runRoot, "screenshots"), { recursive: true });
  return runRoot;
}

async function waitForAppContent(page, selectors = []) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(350);
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count().catch(() => 0)) {
      await locator.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      return;
    }
  }
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 20, null, { timeout: 12000 }).catch(() => undefined);
}

async function applySession(context, config) {
  const cookieValue = process.env.QA_SESSION_COOKIE || process.env.XONE_QA_OWNER_SESSION || config.auth?.sessionCookieValue || "";
  const cookieName = process.env.QA_SESSION_COOKIE_NAME || config.auth?.sessionCookieName || "xone_owner_session";
  if (!cookieValue) return;
  const base = new URL(config.baseUrl);
  await context.addCookies([{
    name: cookieName,
    value: cookieValue,
    domain: base.hostname,
    path: "/",
    httpOnly: true,
    secure: base.protocol === "https:",
    sameSite: "Lax"
  }]);
}

async function loginIfNeeded(page, config, targetUrl) {
  const login = config.auth?.login || {};
  const loginUrlPattern = new RegExp(login.urlPattern || "/login(?:\\?|$)");
  if (!loginUrlPattern.test(page.url())) return { ok: true, method: "existing-session" };
  const password = process.env.QA_PASSWORD || process.env.XONE_QA_OWNER_PASSWORD || login.password || "";
  if (!password || !login.passwordSelector) {
    return { ok: false, method: "missing-credentials", message: "Auth required, but password or passwordSelector is missing." };
  }
  if (login.usernameSelector && (process.env.QA_USERNAME || login.username)) {
    await page.fill(login.usernameSelector, process.env.QA_USERNAME || login.username);
  }
  await page.fill(login.passwordSelector, password);
  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => undefined),
    page.click(login.submitSelector || 'button[type="submit"], input[type="submit"]')
  ]);
  await page.waitForTimeout(500);
  if (loginUrlPattern.test(page.url())) return { ok: false, method: "password", message: "Login did not leave login page." };
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  return { ok: true, method: "password" };
}

async function openPage(page, config, pageSpec) {
  const url = new URL(pageSpec.path || "/", config.baseUrl).toString();
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForAppContent(page, config.waitForSelectors || pageSpec.waitForSelectors || []);
  const login = await loginIfNeeded(page, config, url);
  await waitForAppContent(page, config.waitForSelectors || pageSpec.waitForSelectors || []);
  return { ...login, navigationStatus: response?.status() ?? null, finalUrl: page.url() };
}

async function runActions(page, actions = []) {
  const issues = [];
  for (const action of actions) {
    try {
      if (action.type === "click") await page.locator(action.selector).first().click({ timeout: action.timeout || 5000 });
      else if (action.type === "fill") await page.locator(action.selector).first().fill(action.value || "", { timeout: action.timeout || 5000 });
      else if (action.type === "select") await page.locator(action.selector).first().selectOption(action.value, { timeout: action.timeout || 5000 });
      else if (action.type === "hover") await page.locator(action.selector).first().hover({ timeout: action.timeout || 5000 });
      else if (action.type === "press") await page.locator(action.selector || "body").first().press(action.key, { timeout: action.timeout || 5000 });
      else if (action.type === "check") await page.locator(action.selector).first().check({ timeout: action.timeout || 5000 });
      else if (action.type === "uncheck") await page.locator(action.selector).first().uncheck({ timeout: action.timeout || 5000 });
      else if (action.type === "clear") await page.locator(action.selector).first().clear({ timeout: action.timeout || 5000 });
      else if (action.type === "scroll") await page.locator(action.selector || "body").first().scrollIntoViewIfNeeded({ timeout: action.timeout || 5000 });
      else if (action.type === "open-tab") await openTab(page, action.name, action.selector);
      else if (action.type === "wait-for-text") await page.getByText(action.text, { exact: !!action.exact }).first().waitFor({ timeout: action.timeout || 7000 });
      else if (action.type === "wait-for-selector") await page.locator(action.selector).first().waitFor({ state: action.state || "visible", timeout: action.timeout || 7000 });
      else if (action.type === "expect-text") await page.getByText(action.text, { exact: !!action.exact }).first().waitFor({ timeout: action.timeout || 7000 });
      else if (action.type === "expect-no-text") {
        const count = await page.getByText(action.text, { exact: !!action.exact }).count();
        if (count) throw new Error(`text is visible/present: ${action.text}`);
      } else if (action.type === "expect-url") {
        const re = new RegExp(action.pattern || action.url || "");
        if (!re.test(page.url())) throw new Error(`url ${page.url()} does not match ${re}`);
      } else if (action.type === "expect-count") {
        const count = await page.locator(action.selector).count();
        const min = action.min ?? action.count ?? 1;
        const max = action.max ?? Infinity;
        if (count < min || count > max) throw new Error(`${action.selector} count ${count}, expected ${min}..${max}`);
      }
      else if (action.type === "wait") await page.waitForTimeout(action.ms || 300);
      else issues.push(issue("actions-work", "warn", `unknown action: ${action.type}`));
      await page.waitForTimeout(action.afterMs || 150);
    } catch (error) {
      issues.push(issue("actions-work", "fail", `${action.type} failed: ${action.selector || action.name || action.text || action.key}: ${error.message}`));
    }
  }
  return issues;
}

async function openTab(page, tabName, selector) {
  if (selector) {
    await page.locator(selector).first().click({ timeout: 5000 });
    await page.waitForTimeout(250);
    return true;
  }
  const byRole = page.getByRole("tab", { name: tabName, exact: true });
  if (await byRole.count().catch(() => 0)) {
    await byRole.first().click();
    await page.waitForTimeout(250);
    return true;
  }
  const byText = page.getByText(tabName, { exact: true });
  if (await byText.count().catch(() => 0)) {
    await byText.first().click();
    await page.waitForTimeout(250);
    return true;
  }
  return false;
}

async function checkExpectedForbidden(page, pageSpec, config) {
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const issues = [];
  for (const expected of pageSpec.expectedText || []) {
    if (!text.includes(expected)) issues.push(issue("expected-text", "fail", `не найдено: ${expected}`));
  }
  const forbiddenList = [...(config.globalForbiddenText || []), ...(pageSpec.forbiddenText || [])];
  for (const forbidden of forbiddenList) {
    if (text.toLowerCase().includes(String(forbidden).toLowerCase())) {
      issues.push(issue("forbidden-text", "fail", `найдено запрещенное: ${forbidden}`));
    }
  }
  for (const rule of pageSpec.customTextRegex || []) {
    const re = new RegExp(rule.pattern, rule.flags || "i");
    const matched = re.test(text);
    if (rule.mustMatch && !matched) issues.push(issue("custom-text-regex", "fail", `не найден regex: ${rule.pattern}`));
    if (rule.mustNotMatch && matched) issues.push(issue("custom-text-regex", "fail", `найден запрещенный regex: ${rule.pattern}`));
  }
  return issues;
}

async function noPageOverflow(page) {
  const data = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  const excess = Math.max(data.scrollWidth, data.bodyScrollWidth) - data.width;
  return excess > 8 ? [issue("no-page-overflow", "fail", `horizontal overflow ${excess}px`)] : [];
}

async function noVisibleOverlap(page) {
  const overlaps = await page.evaluate(() => {
    const selector = "button, input:not([type=hidden]), textarea, select, [role=combobox], [role=checkbox], [role=tab], a[href]";
    const nodes = Array.from(document.querySelectorAll(selector)).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 12 && rect.height > 12 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    });
    const items = nodes.map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
      text: (element.innerText || element.getAttribute("aria-label") || element.getAttribute("name") || element.tagName).trim().slice(0, 50)
    }));
    const result = [];
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const x = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
        const y = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
        if (x * y > 180 && x > 8 && y > 8) result.push(`${a.text || a.element.tagName} ↔ ${b.text || b.element.tagName} (${Math.round(x)}x${Math.round(y)})`);
        if (result.length >= 8) return result;
      }
    }
    return result;
  });
  return overlaps.length ? [issue("no-visible-overlap", "warn", overlaps.join("; "))] : [];
}

async function formControlsVisible(page) {
  const bad = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll("button, input:not([type=hidden]), textarea, select, [role=combobox], [role=checkbox], [role=tab]"));
    return controls.flatMap((element) => {
      if (element.closest("[aria-hidden='true'], .sr-only")) return [];
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0 || rect.width === 0 || rect.height === 0) return [];
      if (rect.width < 14 || rect.height < 14) return [`${element.tagName.toLowerCase()} too small ${Math.round(rect.width)}x${Math.round(rect.height)}`];
      return [];
    }).slice(0, 10);
  });
  return bad.length ? [issue("form-controls-visible", "fail", bad.join("; "))] : [];
}

async function labelsCheck(page) {
  const bad = await page.evaluate(() => Array.from(document.querySelectorAll("input:not([type=hidden]), textarea, select")).flatMap((element) => {
    if (element.closest("[aria-hidden='true'], .sr-only")) return [];
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    const hasName = element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.closest("label") || (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`));
    return hasName ? [] : [element.getAttribute("name") || element.getAttribute("placeholder") || element.tagName];
  }).slice(0, 12));
  return bad.length ? [issue("inputs-have-labels", "warn", `controls without accessible labels: ${bad.join(", ")}`)] : [];
}

async function buttonNames(page) {
  const bad = await page.evaluate(() => Array.from(document.querySelectorAll("button, [role=button], a[href]")).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    const name = (element.innerText || element.getAttribute("aria-label") || element.getAttribute("title") || "").trim();
    return name ? [] : [element.tagName];
  }).slice(0, 12));
  return bad.length ? [issue("buttons-have-names", "warn", `clickable without name: ${bad.join(", ")}`)] : [];
}

async function textareaResizable(page) {
  const blocked = await page.evaluate(() => Array.from(document.querySelectorAll("textarea")).flatMap((textarea) => {
    const rect = textarea.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    return window.getComputedStyle(textarea).resize === "none" ? [textarea.getAttribute("name") || textarea.getAttribute("placeholder") || "textarea"] : [];
  }).slice(0, 12));
  return blocked.length ? [issue("textarea-resizable", "fail", `textarea fixed: ${blocked.join(", ")}`)] : [];
}

async function brokenImages(page) {
  const broken = await page.evaluate(() => Array.from(document.images).flatMap((image) => {
    const rect = image.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    return image.complete && image.naturalWidth > 0 ? [] : [image.currentSrc || image.src || image.alt || "image"];
  }).slice(0, 10));
  return broken.length ? [issue("broken-images", "fail", `broken images: ${broken.join(", ")}`)] : [];
}

async function infoTooltips(page, screenshotDir, pageId, viewportName, pageSpec, config) {
  const tooltipConfig = { ...(config.tooltip || {}), ...(pageSpec.tooltip || {}) };
  const triggerSelector = tooltipConfig.triggerSelector || ".xone-field-info, [data-qa-tooltip], [aria-describedby]";
  const tooltipSelector = tooltipConfig.tooltipSelector || ".xone-field-info-portal-tooltip, [role=tooltip], .tooltip";
  const count = await page.locator(triggerSelector).count().catch(() => 0);
  if (count === 0) return tooltipConfig.required === false ? [] : [issue("info-tooltips", "warn", `no tooltip triggers: ${triggerSelector}`)];
  const issues = [];
  const sampleCount = Math.min(count, tooltipConfig.maxSamples || 10);
  for (let index = 0; index < sampleCount; index += 1) {
    const trigger = page.locator(triggerSelector).nth(index);
    await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
    await trigger.hover({ timeout: 2500 }).catch(() => undefined);
    await page.waitForTimeout(150);
    const tooltip = page.locator(tooltipSelector).last();
    const visible = await tooltip.isVisible().catch(() => false);
    if (!visible) {
      issues.push(issue("info-tooltips", "fail", `tooltip #${index + 1} is not visible`));
      continue;
    }
    const bounds = await tooltip.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, zIndex: Number(style.zIndex || 0), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    });
    if (bounds.left < 0 || bounds.top < 0 || bounds.right > bounds.viewportWidth || bounds.bottom > bounds.viewportHeight) issues.push(issue("info-tooltips", "fail", `tooltip #${index + 1} clipped by viewport`));
    if (bounds.zIndex < (tooltipConfig.minZIndex || 1000)) issues.push(issue("info-tooltips", "warn", `tooltip #${index + 1} low z-index ${bounds.zIndex}`));
    if (index === 0) await page.screenshot({ path: join(screenshotDir, `${safeId(pageId)}-${viewportName}-tooltip.png`), fullPage: false });
    await page.mouse.move(4, 4).catch(() => undefined);
  }
  return issues.slice(0, 10);
}

async function tabsOpen(page, pageSpec) {
  const issues = [];
  for (const tabName of pageSpec.tabs || []) {
    const opened = await openTab(page, tabName);
    if (!opened) issues.push(issue("tabs-open", "fail", `tab not found/opened: ${tabName}`));
  }
  return issues;
}

async function selectsReadable(page) {
  const bad = await page.evaluate(() => Array.from(document.querySelectorAll("select, [role=combobox]")).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").trim();
    if (!text) return [];
    const roughTextWidth = Math.min(text.length, 80) * 8;
    return rect.width + 24 < roughTextWidth ? [`${text.slice(0, 60)} (${Math.round(rect.width)}px)`] : [];
  }).slice(0, 10));
  return bad.length ? [issue("selects-readable", "warn", `possible clipped select text: ${bad.join("; ")}`)] : [];
}

async function tableHasRows(page, pageSpec) {
  const selector = pageSpec.tableSelector || "table";
  const minRows = pageSpec.minTableRows ?? 1;
  const rows = await page.locator(`${selector} tbody tr, ${selector} [role=row]`).count().catch(() => 0);
  return rows < minRows ? [issue("table-has-rows", "fail", `${selector} rows ${rows}, expected >= ${minRows}`)] : [];
}

function networkOptions(config, pageSpec) {
  return {
    ignoreUrlPatterns: [
      "favicon\\.ico",
      ...(config.network?.ignoreUrlPatterns || []),
      ...(pageSpec.network?.ignoreUrlPatterns || [])
    ],
    allowStatus: [
      ...(config.network?.allowStatus || []),
      ...(pageSpec.network?.allowStatus || [])
    ],
    severity: pageSpec.network?.severity || config.network?.severity || "fail"
  };
}

function isAllowedStatus(status, allowStatus = []) {
  return allowStatus.some((allowed) => {
    if (Array.isArray(allowed)) return status >= allowed[0] && status <= allowed[1];
    return status === allowed;
  });
}

async function httpStatusOk(pageSpec, networkData) {
  const status = networkData.navigationStatus;
  const allowed = pageSpec.allowedStatus || [200, 204, 301, 302, 304];
  if (!status || isAllowedStatus(status, allowed)) return [];
  return [issue("http-status-ok", "fail", `main navigation status ${status} at ${networkData.finalUrl}`)];
}

async function networkClean(pageSpec, config, networkData) {
  const options = networkOptions(config, pageSpec);
  const failed = networkData.failedRequests
    .filter((request) => !matchesAny(request.url, options.ignoreUrlPatterns))
    .map((request) => `${request.method} ${request.url} (${request.failure})`);
  const badResponses = networkData.responses
    .filter((response) => response.status >= 400)
    .filter((response) => !isAllowedStatus(response.status, options.allowStatus))
    .filter((response) => !matchesAny(response.url, options.ignoreUrlPatterns))
    .map((response) => `${response.status} ${response.method} ${response.url}`);
  const problems = [...failed, ...badResponses];
  return problems.length ? [issueWithSeverity("network-clean", options.severity, compactList(problems, 10))] : [];
}

async function basicSeo(page, pageSpec, config) {
  const seo = { ...(config.seo || {}), ...(pageSpec.seo || {}) };
  const data = await page.evaluate(() => ({
    title: document.title.trim(),
    description: document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "",
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") || ""
  }));
  const issues = [];
  const minTitleLength = numberOr(seo.minTitleLength, 5);
  if (data.title.length < minTitleLength) issues.push(issue("basic-seo", "warn", `title is too short (${data.title.length})`));
  if (seo.requireDescription && data.description.length < numberOr(seo.minDescriptionLength, 30)) issues.push(issue("basic-seo", "warn", "meta description is missing or too short"));
  if (seo.requireCanonical && !data.canonical) issues.push(issue("basic-seo", "warn", "canonical link is missing"));
  if (seo.forbidNoindex && /\bnoindex\b/i.test(data.robots)) issues.push(issue("basic-seo", "fail", "page has robots noindex"));
  return issues;
}

async function landmarks(page, pageSpec, config) {
  const options = { ...(config.landmarks || {}), ...(pageSpec.landmarks || {}) };
  const data = await page.evaluate(() => ({
    main: document.querySelectorAll("main, [role=main]").length,
    h1: Array.from(document.querySelectorAll("h1")).filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }).length
  }));
  const issues = [];
  if (options.requireMain !== false && data.main === 0) issues.push(issue("landmarks", "warn", "missing main landmark"));
  if (options.requireSingleH1 !== false && data.h1 !== 1) issues.push(issue("landmarks", "warn", `visible h1 count ${data.h1}, expected 1`));
  return issues;
}

async function ariaSmoke(page) {
  const bad = await page.evaluate(() => {
    const issues = [];
    const ids = new Map();
    for (const element of document.querySelectorAll("[id]")) {
      const id = element.id;
      ids.set(id, (ids.get(id) || 0) + 1);
    }
    for (const [id, count] of ids.entries()) {
      if (count > 1) issues.push(`duplicate id #${id} (${count})`);
      if (issues.length >= 12) return issues;
    }
    for (const element of document.querySelectorAll("[aria-controls], [aria-describedby], [aria-labelledby]")) {
      for (const attr of ["aria-controls", "aria-describedby", "aria-labelledby"]) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        const missing = value.split(/\s+/).filter((id) => id && !document.getElementById(id));
        if (missing.length) issues.push(`${attr} references missing id(s): ${missing.join(",")}`);
      }
      if (issues.length >= 12) return issues;
    }
    for (const image of document.querySelectorAll("img")) {
      const rect = image.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && !image.hasAttribute("alt")) issues.push(`img missing alt: ${image.currentSrc || image.src || "inline"}`);
      if (issues.length >= 12) return issues;
    }
    return issues;
  });
  return bad.length ? [issue("aria-smoke", "warn", compactList(bad, 12))] : [];
}

async function clickablesEnabled(page) {
  const bad = await page.evaluate(() => Array.from(document.querySelectorAll("button, [role=button], a[href], input[type=submit], input[type=button]")).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (rect.width === 0 || rect.height === 0 || style.display === "none" || style.visibility === "hidden") return [];
    const disabled = element.disabled || element.getAttribute("aria-disabled") === "true";
    const label = (element.innerText || element.getAttribute("aria-label") || element.getAttribute("href") || element.tagName).trim().slice(0, 80);
    return disabled ? [label] : [];
  }).slice(0, 12));
  return bad.length ? [issue("clickables-enabled", "warn", `visible disabled clickables: ${bad.join(", ")}`)] : [];
}

async function focusVisible(page, pageSpec, config) {
  const options = { ...(config.focus || {}), ...(pageSpec.focus || {}) };
  const selector = options.selector || "button, a[href], input:not([type=hidden]), textarea, select, [tabindex]:not([tabindex='-1'])";
  const maxSamples = options.maxSamples || 8;
  const bad = await page.evaluate(async ({ selector, maxSamples }) => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const candidates = Array.from(document.querySelectorAll(selector)).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 10 && rect.height > 10 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }).slice(0, maxSamples);
    const result = [];
    for (const element of candidates) {
      element.focus();
      await sleep(25);
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const hasOutline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 1;
      const hasRing = style.boxShadow && style.boxShadow !== "none";
      if (!hasOutline && !hasRing) {
        const label = (element.innerText || element.getAttribute("aria-label") || element.getAttribute("name") || element.tagName).trim().slice(0, 60);
        result.push(`${label || element.tagName} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }
      if (result.length >= 8) return result;
    }
    return result;
  }, { selector, maxSamples });
  return bad.length ? [issue("focus-visible", "warn", `no obvious focus indicator: ${bad.join("; ")}`)] : [];
}

async function linksValid(page, pageSpec, config) {
  const options = { ...(config.links || {}), ...(pageSpec.links || {}) };
  const baseHost = new URL(config.baseUrl).host;
  const maxSamples = options.maxSamples || 25;
  const includeExternal = !!options.includeExternal;
  const links = await page.evaluate(({ maxSamples, includeExternal, baseHost }) => {
    const seen = new Set();
    return Array.from(document.querySelectorAll("a[href]")).flatMap((anchor) => {
      const href = anchor.href;
      if (!href || seen.has(href)) return [];
      seen.add(href);
      const url = new URL(href, document.baseURI);
      if (["mailto:", "tel:", "javascript:"].includes(url.protocol)) return [];
      if (!includeExternal && url.host !== baseHost) return [];
      const rect = anchor.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      return [url.toString()];
    }).slice(0, maxSamples);
  }, { maxSamples, includeExternal, baseHost });
  const bad = [];
  for (const href of links) {
    if (matchesAny(href, options.ignoreUrlPatterns || [])) continue;
    let response = await page.context().request.head(href, { timeout: options.timeout || 7000, failOnStatusCode: false }).catch(() => null);
    if (!response || response.status() === 405) response = await page.context().request.get(href, { timeout: options.timeout || 7000, failOnStatusCode: false }).catch(() => null);
    if (!response) bad.push(`request failed ${href}`);
    else if (response.status() >= 400 && !isAllowedStatus(response.status(), options.allowStatus || [])) bad.push(`${response.status()} ${href}`);
    if (bad.length >= 10) break;
  }
  return bad.length ? [issueWithSeverity("links-valid", options.severity || "warn", compactList(bad, 10))] : [];
}

async function performanceBudget(page, pageSpec, config) {
  const budget = { ...(config.performance || {}), ...(pageSpec.performance || {}) };
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
      load: nav ? Math.round(nav.loadEventEnd) : 0,
      transferSize: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
      resourceCount: resources.length
    };
  });
  const issues = [];
  if (budget.maxDomContentLoadedMs && data.domContentLoaded > budget.maxDomContentLoadedMs) issues.push(issue("performance-budget", "warn", `DOMContentLoaded ${data.domContentLoaded}ms > ${budget.maxDomContentLoadedMs}ms`));
  if (budget.maxLoadMs && data.load > budget.maxLoadMs) issues.push(issue("performance-budget", "warn", `load ${data.load}ms > ${budget.maxLoadMs}ms`));
  if (budget.maxTransferKb && data.transferSize / 1024 > budget.maxTransferKb) issues.push(issue("performance-budget", "warn", `transfer ${Math.round(data.transferSize / 1024)}KB > ${budget.maxTransferKb}KB`));
  if (budget.maxResourceCount && data.resourceCount > budget.maxResourceCount) issues.push(issue("performance-budget", "warn", `resources ${data.resourceCount} > ${budget.maxResourceCount}`));
  return issues;
}

async function executeChecks(page, pageSpec, config, screenshotDir, viewportName, consoleMessages, pageErrors, networkData) {
  const checks = new Set([...(config.defaultChecks || []), ...(pageSpec.checks || [])]);
  const issues = [];
  if (checks.has("expected-text") || pageSpec.expectedText || pageSpec.forbiddenText || config.globalForbiddenText) issues.push(...await checkExpectedForbidden(page, pageSpec, config));
  if (checks.has("console-clean")) {
    const severe = consoleMessages.filter((msg) => ["error"].includes(msg.type));
    if (severe.length) issues.push(issue("console-clean", "fail", severe.slice(0, 6).map((msg) => msg.text).join("; ")));
  }
  if (checks.has("pageerror-clean") && pageErrors.length) issues.push(issue("pageerror-clean", "fail", pageErrors.slice(0, 6).join("; ")));
  if (checks.has("no-page-overflow")) issues.push(...await noPageOverflow(page));
  if (checks.has("no-visible-overlap")) issues.push(...await noVisibleOverlap(page));
  if (checks.has("form-controls-visible")) issues.push(...await formControlsVisible(page));
  if (checks.has("inputs-have-labels")) issues.push(...await labelsCheck(page));
  if (checks.has("buttons-have-names")) issues.push(...await buttonNames(page));
  if (checks.has("textarea-resizable")) issues.push(...await textareaResizable(page));
  if (checks.has("broken-images")) issues.push(...await brokenImages(page));
  if (checks.has("info-tooltips")) issues.push(...await infoTooltips(page, screenshotDir, pageSpec.id, viewportName, pageSpec, config));
  if (checks.has("tabs-open")) issues.push(...await tabsOpen(page, pageSpec));
  if (checks.has("actions-work")) issues.push(...await runActions(page, pageSpec.actions || []));
  if (checks.has("selects-readable")) issues.push(...await selectsReadable(page));
  if (checks.has("table-has-rows")) issues.push(...await tableHasRows(page, pageSpec));
  if (checks.has("http-status-ok")) issues.push(...await httpStatusOk(pageSpec, networkData));
  if (checks.has("network-clean")) issues.push(...await networkClean(pageSpec, config, networkData));
  if (checks.has("basic-seo")) issues.push(...await basicSeo(page, pageSpec, config));
  if (checks.has("landmarks")) issues.push(...await landmarks(page, pageSpec, config));
  if (checks.has("aria-smoke")) issues.push(...await ariaSmoke(page));
  if (checks.has("clickables-enabled")) issues.push(...await clickablesEnabled(page));
  if (checks.has("focus-visible")) issues.push(...await focusVisible(page, pageSpec, config));
  if (checks.has("links-valid")) issues.push(...await linksValid(page, pageSpec, config));
  if (checks.has("performance-budget")) issues.push(...await performanceBudget(page, pageSpec, config));
  return issues;
}

function resultStatus(issues) {
  if (issues.some((item) => item.severity === "fail")) return "fail";
  if (issues.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}

function writeReports(config, configPath, artifactRoot, results, commandProofs, apiProofs) {
  const summary = {
    pass: results.filter((item) => item.status === "pass").length,
    warn: results.filter((item) => item.status === "warn").length,
    fail: results.filter((item) => item.status === "fail").length,
    commandPass: commandProofs.filter((item) => item.status === "pass").length,
    commandWarn: commandProofs.filter((item) => item.status === "warn").length,
    commandFail: commandProofs.filter((item) => item.status === "fail").length,
    apiPass: apiProofs.filter((item) => item.status === "pass").length,
    apiWarn: apiProofs.filter((item) => item.status === "warn").length,
    apiFail: apiProofs.filter((item) => item.status === "fail").length
  };
  const jsonPath = join(artifactRoot, "report.json");
  const mdPath = join(artifactRoot, "report.md");
  writeFileSync(jsonPath, JSON.stringify({ configPath, baseUrl: config.baseUrl, summary, results, commandProofs, apiProofs }, null, 2));
  const lines = [
    `# Universal QA Report`,
    ``,
    `Date: ${new Date().toISOString()}`,
    `Project: ${config.name || "Unnamed"}`,
    `Base URL: ${config.baseUrl}`,
    `Config: ${configPath}`,
    ``,
    `## Summary`,
    ``,
    `- Browser PASS: ${summary.pass}`,
    `- Browser WARN: ${summary.warn}`,
    `- Browser FAIL: ${summary.fail}`,
    `- Command PASS: ${summary.commandPass}`,
    `- Command WARN: ${summary.commandWarn}`,
    `- Command FAIL: ${summary.commandFail}`,
    `- API PASS: ${summary.apiPass}`,
    `- API WARN: ${summary.apiWarn}`,
    `- API FAIL: ${summary.apiFail}`,
    ``,
    `## Browser Checks`,
    ``,
    `| Page | Viewport | Status | Issues | Screenshot |`,
    `|---|---:|---|---|---|`
  ];
  for (const item of results) {
    const issues = item.issues.length ? item.issues.map((entry) => `${entry.severity.toUpperCase()} ${entry.check}: ${entry.details}`).join("<br>") : "нет";
    lines.push(`| ${item.title || item.pageId} | ${item.viewport} | ${item.status.toUpperCase()} | ${issues} | ${item.screenshotPath ? markdownLink("png", item.screenshotPath) : ""} |`);
  }
  if (commandProofs.length) {
    lines.push(``, `## Command Proofs`, ``, `| Name | Status | Command | Output |`, `|---|---|---|---|`);
    for (const proof of commandProofs) {
      lines.push(`| ${proof.name} | ${proof.status.toUpperCase()} | \`${proof.command}\` | ${normalizeText(proof.output).slice(0, 500)} |`);
    }
  }
  if (apiProofs.length) {
    lines.push(``, `## API Proofs`, ``, `| Name | Status | Request | Details |`, `|---|---|---|---|`);
    for (const proof of apiProofs) {
      lines.push(`| ${proof.name} | ${proof.status.toUpperCase()} | \`${proof.method} ${proof.url}\` | ${normalizeText(proof.details).slice(0, 500)} |`);
    }
  }
  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  return { summary, jsonPath, mdPath };
}

function runCommandProofs(config, configPath) {
  const proofs = [];
  for (const proof of config.commandProofs || []) {
    const args = Array.isArray(proof.args) ? proof.args : [];
    const result = spawnSync(proof.command, args, {
      cwd: resolveMaybe(dirname(configPath), proof.cwd || "."),
      env: { ...process.env, ...(proof.env || {}) },
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    let status = result.status === 0 ? "pass" : "fail";
    if (proof.expectedText && !output.includes(proof.expectedText)) status = "fail";
    if (proof.forbiddenText && output.includes(proof.forbiddenText)) status = "fail";
    if (proof.warnOnly && status === "fail") status = "warn";
    proofs.push({ name: proof.name || proof.command, command: [proof.command, ...args].join(" "), status, output });
  }
  return proofs;
}

async function runApiProofs(config) {
  const proofs = [];
  for (const proof of config.apiProofs || []) {
    const method = String(proof.method || "GET").toUpperCase();
    const url = new URL(proof.path || proof.url || "/", proof.baseUrl || config.baseUrl).toString();
    const started = Date.now();
    let status = "pass";
    let details = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), proof.timeout || 10000);
      const response = await fetch(url, {
        method,
        headers: proof.headers || {},
        body: proof.body === undefined ? undefined : (typeof proof.body === "string" ? proof.body : JSON.stringify(proof.body)),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const elapsedMs = Date.now() - started;
      const text = await response.text();
      const allowedStatus = proof.allowedStatus || [200, 201, 202, 204, 301, 302, 304];
      if (!isAllowedStatus(response.status, allowedStatus)) status = "fail";
      if (proof.maxMs && elapsedMs > proof.maxMs) status = "fail";
      if (proof.expectedText && !text.includes(proof.expectedText)) status = "fail";
      if (proof.forbiddenText && text.includes(proof.forbiddenText)) status = "fail";
      if (proof.jsonPath) {
        try {
          const json = JSON.parse(text);
          const value = proof.jsonPath.split(".").reduce((acc, key) => acc?.[key], json);
          if (proof.expectedValue !== undefined && value !== proof.expectedValue) status = "fail";
          if (proof.exists !== false && value === undefined) status = "fail";
        } catch {
          status = "fail";
        }
      }
      if (proof.warnOnly && status === "fail") status = "warn";
      details = `${response.status} in ${elapsedMs}ms; ${normalizeText(text).slice(0, 400)}`;
    } catch (error) {
      status = proof.warnOnly ? "warn" : "fail";
      details = error.message;
    }
    proofs.push({ name: proof.name || url, method, url, status, details });
  }
  return proofs;
}

export function loadPlaywright() {
  const candidatePaths = [
    agentRoot,
    process.cwd(),
    resolve(agentRoot, "../ai-office/apps/web"),
    resolve(agentRoot, "../../ai-office/apps/web")
  ];
  for (const candidate of candidatePaths) {
    try {
      const resolved = require.resolve("@playwright/test", { paths: [candidate] });
      return require(resolved);
    } catch {
      // Try the next known project root.
    }
  }
  throw new Error(
    "Cannot find @playwright/test. Run `npm install` in universal-qa-agent or set up Playwright in the current project."
  );
}

async function runBrowser(config, configPath, artifactRoot, cli) {
  const { chromium } = loadPlaywright();
  const screenshotDir = join(artifactRoot, "screenshots");
  const storageState = process.env.QA_STORAGE_STATE || process.env.XONE_QA_STORAGE_STATE || config.auth?.storageState || "";
  const contextOptions = {
    ignoreHTTPSErrors: true,
    storageState: storageState && existsSync(resolveMaybe(dirname(configPath), storageState)) ? resolveMaybe(dirname(configPath), storageState) : undefined
  };
  const browser = await chromium.launch({ headless: !(cli.headed || process.env.QA_HEADED === "1" || process.env.XONE_QA_HEADED === "1") });
  const results = [];
  try {
    for (const viewport of config.viewports || [{ name: "desktop", width: 1440, height: 900 }]) {
      const context = await browser.newContext({ ...contextOptions, viewport: { width: viewport.width, height: viewport.height } });
      await applySession(context, config);
      for (const pageSpec of config.pages) {
        const page = await context.newPage();
        const consoleMessages = [];
        const pageErrors = [];
        const failedRequests = [];
        const responses = [];
        page.on("console", (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("requestfailed", (request) => failedRequests.push({
          method: request.method(),
          url: request.url(),
          failure: request.failure()?.errorText || "failed"
        }));
        page.on("response", (response) => responses.push({
          method: response.request().method(),
          url: response.url(),
          status: response.status(),
          resourceType: response.request().resourceType()
        }));
        const issues = [];
        const login = await openPage(page, config, pageSpec);
        if (!login.ok) issues.push(issue("auth", "fail", login.message));
        if (pageSpec.openTab) {
          const opened = await openTab(page, pageSpec.openTab, pageSpec.openTabSelector);
          if (!opened) issues.push(issue("open-tab", "fail", `tab not opened: ${pageSpec.openTab}`));
        }
        issues.push(...await runActions(page, pageSpec.beforeChecks || []));
        issues.push(...await executeChecks(page, pageSpec, config, screenshotDir, viewport.name, consoleMessages, pageErrors, {
          navigationStatus: login.navigationStatus,
          finalUrl: login.finalUrl,
          failedRequests,
          responses
        }));
        const screenshotPath = join(screenshotDir, `${safeId(pageSpec.id)}-${safeId(viewport.name)}-full.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        results.push({ pageId: pageSpec.id, title: pageSpec.title, viewport: viewport.name, status: resultStatus(issues), issues, screenshotPath });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

export async function runCli(argv = process.argv.slice(2)) {
  const cli = parseArgs(argv);
  if (cli.help) {
    console.log(usage());
    return;
  }
  if (cli.listChecks) {
    console.log(builtInChecks.join("\n"));
    return;
  }
  const configPath = resolve(cli.configPath || process.env.QA_CONFIG || defaultConfigPath);
  const config = readJson(configPath);
  config.baseUrl = (cli.baseUrl || process.env.QA_BASE_URL || process.env.XONE_QA_BASE_URL || config.baseUrl || "http://127.0.0.1:3000").replace(/\/$/, "");
  if (!Array.isArray(config.pages) || !config.pages.length) throw new Error("Config must contain pages[]");
  const artifactRoot = makeArtifactRoot(config, configPath);
  const browserResults = await runBrowser(config, configPath, artifactRoot, cli);
  const commandProofs = runCommandProofs(config, configPath);
  const apiProofs = await runApiProofs(config);
  const report = writeReports(config, configPath, artifactRoot, browserResults, commandProofs, apiProofs);
  console.log(`Universal QA report: ${report.mdPath}`);
  console.log(`PASS=${report.summary.pass + report.summary.commandPass + report.summary.apiPass} WARN=${report.summary.warn + report.summary.commandWarn + report.summary.apiWarn} FAIL=${report.summary.fail + report.summary.commandFail + report.summary.apiFail}`);
  const strict = cli.strict && process.env.QA_STRICT !== "0";
  if (strict && (report.summary.fail || report.summary.commandFail || report.summary.apiFail)) process.exit(1);
}

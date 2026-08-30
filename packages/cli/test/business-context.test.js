import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });
}

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-business-context-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  return root;
}

test("Lite installation includes agent-neutral module and business indexes", () => {
  const root = createProject();
  const result = run(root, ["init", "."]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "tech", "modules.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "README.md")), true);
  assert.doesNotMatch(fs.readFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "utf8"), /\*\*\* Add File/);
});

test("route returns only the named domain context and defers unrelated domains", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const businessRoot = path.join(root, "spectra", "sdd", "memory-bank", "business");
  fs.mkdirSync(path.join(businessRoot, "loyalty"), { recursive: true });
  fs.mkdirSync(path.join(businessRoot, "payments"), { recursive: true });
  fs.writeFileSync(
    path.join(businessRoot, "INDEX.md"),
    [
      "# Business Domain Index",
      "",
      "| Domain | Rules | Unresolved | Related Modules |",
      "| --- | --- | --- | --- |",
      "| loyalty | business/loyalty/rules.md | business/loyalty/unresolved.md | orders |",
      "| payments | business/payments/rules.md | business/payments/unresolved.md | payments |",
      ""
    ].join("\n")
  );
  fs.writeFileSync(path.join(businessRoot, "loyalty", "rules.md"), "# Loyalty Rules\n");
  fs.writeFileSync(path.join(businessRoot, "loyalty", "unresolved.md"), "# Unresolved Loyalty Rules\n");
  fs.writeFileSync(path.join(businessRoot, "payments", "rules.md"), "# Payment Rules\n");
  fs.writeFileSync(path.join(businessRoot, "payments", "unresolved.md"), "# Unresolved Payment Rules\n");

  const result = run(root, ["route", "--task", "Change loyalty expiration in the order flow", "--format", "json"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const route = JSON.parse(result.stdout);
  assert.equal(route.classification, "business");
  assert.deepEqual(route.domains, ["loyalty"]);
  assert.ok(route.entries.some((entry) => entry.path === "sdd/memory-bank/business/loyalty/rules.md"));
  assert.ok(!route.entries.some((entry) => entry.path === "sdd/memory-bank/business/payments/rules.md"));
  assert.ok(route.deferred.includes("sdd/memory-bank/business/payments/rules.md"));
});

test("knowledge creates one canonical unresolved rule and promotes it without duplication", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);

  const add = run(root, [
    "knowledge", "add", "--domain", "loyalty", "--title", "Expired point consumption",
    "--statement", "Expired points cannot pay for an order.", "--status", "unresolved"
  ]);
  assert.equal(add.status, 0, add.stderr || add.stdout);
  assert.match(add.stdout, /RULE-LOY-001/);

  const promote = run(root, ["knowledge", "promote", "--id", "RULE-LOY-001"]);
  assert.equal(promote.status, 0, promote.stderr || promote.stdout);
  const rules = fs.readFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty", "rules.md"), "utf8");
  const unresolved = fs.readFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty", "unresolved.md"), "utf8");
  assert.match(rules, /RULE-LOY-001/);
  assert.doesNotMatch(unresolved, /RULE-LOY-001/);
});

test("knowledge resolve is an alias for promoting an unresolved rule", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);

  const add = run(root, [
    "knowledge", "add", "--domain", "loyalty", "--title", "Birthday points",
    "--statement", "Birthday points expire after 30 days.", "--status", "unresolved"
  ]);
  assert.equal(add.status, 0, add.stderr || add.stdout);

  const resolve = run(root, ["knowledge", "resolve", "--id", "RULE-LOY-001"]);

  assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
  const rules = fs.readFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty", "rules.md"), "utf8");
  assert.match(rules, /Status: active/);
});

test("route expands a selected module into its linked multi-word business domain", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const memory = path.join(root, "spectra", "sdd", "memory-bank");
  fs.writeFileSync(path.join(memory, "tech", "modules.md"), "| Module | Responsibility | Paths | Business Domains |\n| --- | --- | --- | --- |\n| order-service | orders | services/orders | loyalty-program |\n");
  fs.mkdirSync(path.join(memory, "business", "loyalty-program"));
  fs.writeFileSync(path.join(memory, "business", "INDEX.md"), "| Domain | Rules | Unresolved | Related Modules |\n| --- | --- | --- | --- |\n| loyalty-program | business/loyalty-program/rules.md | business/loyalty-program/unresolved.md | order-service |\n");
  fs.writeFileSync(path.join(memory, "business", "loyalty-program", "rules.md"), "# Rules\n");
  fs.writeFileSync(path.join(memory, "business", "loyalty-program", "unresolved.md"), "# Unresolved\n");
  const result = run(root, ["route", "--task", "Change loyalty program expiration", "--format", "json"]);
  const route = JSON.parse(result.stdout);
  assert.deepEqual(route.domains, ["loyalty-program"]);
  assert.ok(route.entries.some((entry) => entry.path.endsWith("loyalty-program/rules.md")));
});

test("route rejects unknown explicit domain and module hints", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);

  const domain = run(root, ["route", "--task", "checkout", "--domain", "missing-domain"]);
  const module = run(root, ["route", "--task", "checkout", "--module", "missing-module"]);

  assert.equal(domain.status, 1);
  assert.match(domain.stdout, /Unknown business domain/);
  assert.equal(module.status, 1);
  assert.match(module.stdout, /Unknown technical module/);
});

test("check rejects duplicate business rule IDs introduced by manual edits", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const domain = path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty");
  fs.mkdirSync(domain);
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "| loyalty | business/loyalty/rules.md | business/loyalty/unresolved.md | |\n");
  fs.writeFileSync(path.join(domain, "rules.md"), "# Rules\n\n## RULE-LOY-001 — One\n\nRule one.\n\nStatus: active\n");
  fs.writeFileSync(path.join(domain, "unresolved.md"), "# Unresolved\n\n## RULE-LOY-001 — Two\n\nRule two.\n\nStatus: unresolved\n");
  const result = run(root, ["check"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Duplicate business rule ID/);
});

test("check rejects a business rule without a status", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const domain = path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty");
  fs.mkdirSync(domain);
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "| loyalty | business/loyalty/rules.md | business/loyalty/unresolved.md | |\n");
  fs.writeFileSync(path.join(domain, "rules.md"), "# Rules\n\n## RULE-LOY-001 — Expiration\n\nExpired points cannot pay.\n");
  fs.writeFileSync(path.join(domain, "unresolved.md"), "# Unresolved\n");
  const result = run(root, ["check"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /must contain exactly one valid Status/);
});

test("check rejects a business index path outside the business-memory root", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "| loyalty | ../../package.json | business/loyalty/unresolved.md | |\n");
  const result = run(root, ["check"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /outside business memory/);
});

test("route rejects a business index path outside the business-memory root", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "| loyalty | ../../package.json | business/loyalty/unresolved.md | |\n");
  const result = run(root, ["route", "--task", "loyalty", "--format", "json"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /outside business memory/);
});

test("context pack composes routed business context and accounts for routed tokens", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const businessRoot = path.join(root, "spectra", "sdd", "memory-bank", "business");
  fs.mkdirSync(path.join(businessRoot, "loyalty"), { recursive: true });
  fs.mkdirSync(path.join(businessRoot, "payments"), { recursive: true });
  fs.writeFileSync(
    path.join(businessRoot, "INDEX.md"),
    [
      "# Business Domain Index",
      "",
      "| Domain | Rules | Unresolved | Related Modules |",
      "| --- | --- | --- | --- |",
      "| loyalty | business/loyalty/rules.md | business/loyalty/unresolved.md | orders |",
      "| payments | business/payments/rules.md | business/payments/unresolved.md | payments |",
      ""
    ].join("\n")
  );
  fs.writeFileSync(path.join(businessRoot, "loyalty", "rules.md"), "# Loyalty Rules\n\n## RULE-LOY-001 — Expiration\n\nExpired points cannot pay.\n\nStatus: active\n");
  fs.writeFileSync(path.join(businessRoot, "loyalty", "unresolved.md"), "# Unresolved Loyalty Rules\n");
  fs.writeFileSync(path.join(businessRoot, "payments", "rules.md"), "# Payment Rules\n\n## RULE-PAY-001 — Capture\n\nPayment capture requires authorization.\n\nStatus: active\n");
  fs.writeFileSync(path.join(businessRoot, "payments", "unresolved.md"), "# Unresolved Payment Rules\n");

  const result = run(root, ["context", "--role", "implementer", "--goal", "implement", "--route-task", "loyalty expiration", "--format", "json"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pack = JSON.parse(result.stdout);
  assert.deepEqual(pack.route.domains, ["loyalty"]);
  assert.ok(pack.entries.some((entry) => entry.path === "sdd/memory-bank/business/loyalty/rules.md" && entry.estimatedTokens > 0));
  assert.ok(!pack.entries.some((entry) => entry.path === "sdd/memory-bank/business/payments/rules.md"));
  assert.ok(pack.avoid.includes("sdd/memory-bank/business/payments/rules.md"));
  assert.equal(pack.totals.estimatedTokens, pack.totals.summary + pack.totals.full);
});

test("context pack accepts route-task as the first-class task input", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const result = run(root, ["context", "--route-task", "loyalty expiration", "--format", "json"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pack = JSON.parse(result.stdout);
  assert.equal(pack.role, "implementer");
  assert.equal(pack.goal, "implement");
  assert.equal(pack.route.task, "loyalty expiration");
});

test("check rejects lifecycle statuses in the wrong business rule file", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const domain = path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty");
  fs.mkdirSync(domain);
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "| loyalty | business/loyalty/rules.md | business/loyalty/unresolved.md | |\n");
  fs.writeFileSync(path.join(domain, "rules.md"), "# Rules\n\n## RULE-LOY-001 — Pending\n\nNeed a decision.\n\nStatus: unresolved\n");
  fs.writeFileSync(path.join(domain, "unresolved.md"), "# Unresolved\n");

  const result = run(root, ["check"]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /cannot be unresolved in rules.md/);
});

test("check rejects duplicate active business rule statements from direct edits", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const domain = path.join(root, "spectra", "sdd", "memory-bank", "business", "loyalty");
  fs.mkdirSync(domain);
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md"), "| loyalty | business/loyalty/rules.md | business/loyalty/unresolved.md | |\n");
  fs.writeFileSync(
    path.join(domain, "rules.md"),
    [
      "# Rules",
      "",
      "## RULE-LOY-001 — First",
      "",
      "Expired points cannot pay.",
      "",
      "Status: active",
      "",
      "## RULE-LOY-002 — Second",
      "",
      "Expired points cannot pay.",
      "",
      "Status: active",
      ""
    ].join("\n")
  );
  fs.writeFileSync(path.join(domain, "unresolved.md"), "# Unresolved\n");

  const result = run(root, ["check"]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Duplicate active business-rule statement/);
});

test("knowledge rejects superseding an unresolved rule before promotion", () => {
  const root = createProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  assert.equal(run(root, [
    "knowledge", "add", "--domain", "loyalty", "--title", "Pending policy",
    "--statement", "Pending policy needs product confirmation.", "--status", "unresolved"
  ]).status, 0);

  const result = run(root, ["knowledge", "supersede", "--id", "RULE-LOY-001"]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Promote it before changing it to superseded/);
  assert.equal(run(root, ["check"]).status, 0);
});

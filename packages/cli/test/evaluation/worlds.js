// Evaluation worlds: throwaway Spectra projects built from fixed content (shop*)
// or from the real repository's canonical knowledge (spectra). Retrieval is
// measured against them in-process; the CLI is only used for init/index setup.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, "..", "..");
const repoRoot = path.resolve(cliRoot, "..", "..");

const sh = (cwd, command, args) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")}: ${result.stderr || result.stdout}`);
};
const spectra = (cwd, ...args) => sh(cwd, process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args]);
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const section = (id, title, body, status, affected) => `## ${id} — ${title}\n\n${body}\n\nStatus: ${status}\n${affected ? `Affected Modules: ${affected}\n` : ""}`;

const LOYALTY_SPEC = {
  metadata: { id: "loyalty-program" },
  requirements: {
    functional: [
      { id: "FR-1", statement: "Customers redeem loyalty points for discounts at checkout" },
      { id: "FR-2", statement: "Expired loyalty points are removed from customer balances nightly" }
    ],
    nonFunctional: []
  },
  acceptance: {
    scenarios: [
      { id: "AC-1", covers: ["FR-1"], given: "a customer with points", when: "they check out", then: "the discount is applied" },
      { id: "AC-2", covers: ["FR-2"], given: "points past their expiry date", when: "the nightly job runs", then: "the balance excludes them" }
    ]
  }
};
const SHIPPING_SPEC = {
  metadata: { id: "shipping" },
  requirements: { functional: [{ id: "FR-1", statement: "Warehouse staff print shipping labels for parcels" }], nonFunctional: [] },
  acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "a packed parcel", when: "staff request a label", then: "a printable label is produced" }] }
};

function shopFiles(root, { bigRule = false, duplicateRule = false, large = false } = {}) {
  const sdd = path.join(root, ".spectra", "sdd");
  const biz = path.join(sdd, "memory-bank", "business");
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  for (const [name, dir] of [["loyalty-api", "loyalty"], ["billing", "billing"]]) {
    write(path.join(root, "packages", dir, "package.json"), JSON.stringify({ name, scripts: { test: "node --test" } }));
    write(path.join(root, "packages", dir, "src", "index.js"), "export const a = 1;\n");
  }
  write(path.join(sdd, "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "",
    "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |",
    "| billing | Billing | packages/billing/ | payments |", ""
  ].join("\n"));
  write(path.join(biz, "INDEX.md"), [
    "# Business Domain Index", "",
    "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points,rewards | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |",
    "| payments | refunds,chargebacks | business/payments/rules.md | business/payments/unresolved.md | billing |", ""
  ].join("\n"));
  const expiry = bigRule ? `Expired points cannot be redeemed for orders. ${"Exceptions are reviewed case by case. ".repeat(160)}` : "Expired points cannot be redeemed for orders.";
  // "large": many unrelated sections so whole-file routing is expensive and exact retrieval is not.
  const filler = large ? Array.from({ length: 40 }, (_, n) => section(`RULE-LOY-${100 + n}`, `Archive audit ${n}`, `Shelving ledger reconciliation procedure ${n} covers cabinet labelling, quarterly signatures and archive rotation for the records office.`, "active")) : [];
  const loyalty = ["# Rules", "", section("RULE-LOY-001", "Expiration", expiry, "active", "loyalty-api"), section("RULE-LOY-002", "Rounding", "Totals round half up when converting points to currency.", "active"), ...filler].join("\n");
  write(path.join(biz, "loyalty", "rules.md"), loyalty);
  write(path.join(biz, "loyalty", "unresolved.md"), `# Unresolved\n\n${section("RULE-LOY-003", "Grace", "Grace period for expired points needs a decision.", "unresolved")}`);
  write(path.join(biz, "payments", "rules.md"), ["# Rules", "", section("RULE-PAY-001", "Settlement", "Refunds follow settlement cycles.", "active", "billing"), section("RULE-PAY-002", "Chargebacks", "Chargebacks freeze the disputed amount.", "active")].join("\n"));
  write(path.join(biz, "payments", "unresolved.md"), "# Unresolved\n");
  if (duplicateRule) write(path.join(biz, "payments", "rules.md"), fs.readFileSync(path.join(biz, "loyalty", "rules.md"), "utf8"));
  const loyaltySpec = large
    ? { ...LOYALTY_SPEC, requirements: { ...LOYALTY_SPEC.requirements, functional: [...LOYALTY_SPEC.requirements.functional, ...Array.from({ length: 30 }, (_, n) => ({ id: `FR-${10 + n}`, statement: `Records office rotates archive cabinet ${n} during quarterly compliance review` }))] } }
    : LOYALTY_SPEC;
  write(path.join(sdd, "features", "loyalty-program", "feature.spec.yaml"), YAML.stringify(loyaltySpec));
  write(path.join(sdd, "features", "shipping", "feature.spec.yaml"), YAML.stringify(SHIPPING_SPEC));
}

function spectraFiles(root) {
  const sdd = path.join(root, ".spectra", "sdd");
  fs.rmSync(path.join(sdd, "features"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "sdd", "features"), path.join(sdd, "features"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "sdd", "memory-bank", "business"), path.join(sdd, "memory-bank", "business"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "sdd", "memory-bank", "tech", "modules.md"), path.join(sdd, "memory-bank", "tech", "modules.md"));
  for (const file of ["package.json", "packages/cli/package.json", "packages/core/package.json", "packages/templates/package.json"]) {
    write(path.join(root, file), fs.readFileSync(path.join(repoRoot, file), "utf8"));
  }
}

const WORLDS = {
  shop: (root) => shopFiles(root),
  "shop-big-rule": (root) => shopFiles(root, { bigRule: true }),
  "shop-duplicate": (root) => shopFiles(root, { duplicateRule: true }),
  "shop-large": (root) => shopFiles(root, { large: true }),
  spectra: spectraFiles
};

function buildWorld(name) {
  if (!WORLDS[name]) throw new Error(`Unknown evaluation world: ${name}`);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `spectra-eval-${name}-`));
  sh(root, "git", ["init", "-q"]);
  sh(root, "git", ["config", "user.email", "eval@example.test"]);
  sh(root, "git", ["config", "user.name", "Spectra Evaluation"]);
  spectra(root, "init", ".");
  WORLDS[name](root);
  spectra(root, "index");
  fs.appendFileSync(path.join(root, ".git", "info", "exclude"), ".spectra/cache/\n");
  sh(root, "git", ["add", "-A"]);
  sh(root, "git", ["commit", "-q", "-m", "evaluation baseline"]);
  // `.spectra` is git-excluded by `spectra init`, so reset restores tracked source
  // files (changed-file cases) and the padded policy file explicitly.
  const minimal = path.join(root, ".spectra", "sdd", "system", "runtime", "minimal.md");
  const minimalOriginal = fs.readFileSync(minimal, "utf8");
  return {
    name,
    root,
    minimal,
    cacheDir: path.join(root, ".spectra", "cache"),
    reset: () => {
      sh(root, "git", ["checkout", "--", "."]);
      fs.writeFileSync(minimal, minimalOriginal);
    },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

export { buildWorld };

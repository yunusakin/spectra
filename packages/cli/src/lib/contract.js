import fs from "node:fs";
import path from "node:path";
import { findSpectraRoot } from "./runtime.js";

// Agent-facing CLI output contract: the JSON that coding agents consume (context, route, inspect,
// verify --explain, verify --gate, status). `contractVersion` versions that output only; it is unrelated to the
// project data `schemaVersion` and to migrations. Bump it only for a breaking change to those shapes.
const CONTRACT_VERSION = 1;

// An expected, classifiable failure. `code` is the stable machine-readable part; the message is for people.
class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const versioned = (result) => ({ contractVersion: CONTRACT_VERSION, ...result });

// A data root as a path relative to the project (e.g. ".spectra"), so the same project state reads the same
// wherever it is checked out.
function portableRoot(cwd, root) {
  const relative = path.relative(findSpectraRoot(cwd) ?? cwd, root).split(path.sep).join("/");
  return relative === "" ? "." : relative;
}

// Parse errors are argument errors; anything already classified keeps its code.
function parseArguments(parse) {
  try {
    return parse();
  } catch (error) {
    throw error instanceof ContractError ? error : new ContractError("invalid-arguments", error.message);
  }
}

function wantsJson(argv) {
  return argv.includes("--json") || argv.includes("--format=json") || argv.some((token, index) => token === "--format" && argv[index + 1] === "json");
}

// Paths a message may mention; they are rendered as "." so a failure reads the same wherever the project lives.
function knownRoots(argv) {
  const cwdFlag = argv.findIndex((token) => token === "--cwd");
  const cwds = [process.cwd(), cwdFlag === -1 ? null : argv[cwdFlag + 1]].filter(Boolean).map((cwd) => path.resolve(cwd));
  const roots = cwds.flatMap((cwd) => {
    let real = cwd;
    try { real = fs.realpathSync(cwd); } catch { /* not on disk: keep the lexical path */ }
    return [cwd, real, findSpectraRoot(cwd)];
  });
  return [...new Set(roots.filter(Boolean))].sort((left, right) => right.length - left.length);
}

// Runs a command; under a JSON request an error becomes one structured document on stdout and exit status 1
// (no stack trace, no absolute path). Without a JSON request the error propagates to the usual `FAIL ...` handler.
function guardJson(argv, command) {
  if (!wantsJson(argv)) return command();
  const report = (error) => {
    const message = knownRoots(argv).reduce((text, root) => text.split(root).join("."), String(error.message));
    process.stdout.write(`${JSON.stringify(versioned({ ok: false, error: { code: error.code ?? "command-failed", message } }))}\n`);
    return 1;
  };
  try {
    const result = command();
    return result instanceof Promise ? result.catch(report) : result;
  } catch (error) {
    return report(error);
  }
}

export { CONTRACT_VERSION, ContractError, guardJson, parseArguments, portableRoot, versioned, wantsJson };

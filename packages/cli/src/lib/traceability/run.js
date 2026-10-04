import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkIndexFreshness, readIndex } from "../index/cache.js";
import { observeSupport, recordVerificationEvidence } from "./evidence.js";

// The only producer of verification evidence. Nothing else in Spectra executes tests: the Repo Index
// records each test target's command (`attributes.command`, Node `scripts.test`) and this runs exactly
// that command, once, for one explicitly requested target, from the target's directory, then records
// the COMPLETED result with the evidence API. It is not a test runner: no discovery, no aggregation,
// no parallelism. Exit 0 is `passed`, any other completed exit is `failed`; an execution that did not
// complete (cannot start, killed by a signal, timed out, shell 126/127) is infrastructure failure and
// records nothing, so a previous valid record is never replaced by a guess.

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const AGGREGATE_COMMAND = /(^|\s)(--workspaces|-ws)(\s|$)|--workspace[=\s]/;

// The Repo Index signature covers absolute paths, so freshness is judged on the real path.
function runTestTarget(givenRoot, testTarget, { timeoutMs = DEFAULT_TIMEOUT_MS, env = process.env } = {}) {
  const projectRoot = fs.realpathSync(givenRoot);
  let index = null;
  try {
    index = readIndex(projectRoot);
  } catch {
    // treated like a missing index below
  }
  const record = (index?.records ?? []).find((candidate) => candidate.id === testTarget && candidate.kind === "test-target");
  if (!record) throw new Error(`Unknown test target: ${testTarget} (see spectra index)`);
  const command = record.attributes?.command;
  if (typeof command !== "string" || command.trim() === "") throw new Error(`Test target ${testTarget} has no recorded command; Spectra cannot run it.`);
  const freshness = checkIndexFreshness(projectRoot);
  if (freshness.status !== "fresh") throw new Error(`The Repo Index is ${freshness.status}; run \`spectra index\` before running a test target.`);

  const observed = observeSupport(projectRoot, testTarget);
  const execution = spawnSync(command, { cwd: path.join(projectRoot, record.path), env, shell: true, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  const output = `${execution.stdout ?? ""}${execution.stderr ?? ""}`.slice(-4000);
  const incomplete = execution.error?.code === "ETIMEDOUT" ? `timed out after ${timeoutMs} ms`
    : execution.error ? `did not complete: ${execution.error.message}`
      : execution.signal ? `did not complete: terminated by ${execution.signal}`
        : execution.status === 126 || execution.status === 127 ? `did not complete: command not found or not executable (exit ${execution.status})`
          : null;
  if (incomplete) return { recorded: false, reason: incomplete, exitStatus: execution.status, command, output };

  const result = execution.status === 0 ? "passed" : "failed";
  const granularity = AGGREGATE_COMMAND.test(command) ? "aggregate" : "test-target";
  recordVerificationEvidence(projectRoot, { testTarget, result, command, granularity, observed });
  return { recorded: true, result, exitStatus: execution.status, command, granularity, output };
}

export { runTestTarget };

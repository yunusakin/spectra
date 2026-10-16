import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { initProject, run } from "./helpers/project.js";

test("installed verify-work rejects empty documents and consistently accepts populated ones", (t) => {
  const root = initProject();
  const core = path.join(root, ".spectra/sdd/memory-bank/core");
  const documents = [
    ["traceability.md", "traceability has content", "traceability is empty"],
    ["activeContext.md", "activeContext populated", "activeContext empty"],
    ["progress.md", "progress populated", "progress empty"],
    ["implementation-brief.md", "implementation brief populated", "implementation brief missing"]
  ];
  const cases = [
    ["missing", null, false],
    ["empty", "", false],
    ["whitespace", " \t\n\t\n", false],
    ["headings and comments", "# Heading\n> Quote\n<!-- Comment -->\n-->\n\n", false],
    ["meaningful", "# Heading\n\nCompleted work.\n", true],
    ["last line without newline", "# Heading\nCompleted work.", true],
    ...Array.from({ length: 5 }, (_, i) => [
      `large populated attempt ${i + 1}`, "Completed work with evidence.\n".repeat(10000), true
    ])
  ];
  const observations = [];
  const artifact = path.join(root, "verify-content-results.json");
  t.diagnostic(`Verify content artifact: ${artifact}`);

  for (const [name, content, populated] of cases) {
    for (const [file] of documents) {
      const target = path.join(core, file);
      if (content === null) fs.rmSync(target, { force: true });
      else fs.writeFileSync(target, content);
    }
    const result = run(root, "bash", [".spectra/cli/assets/runtime/scripts/verify-work.sh", "--scope", "app"], {
      SPECTRA_REPO_ROOT: path.join(root, ".spectra"),
      SPECTRA_PROJECT_ROOT: root
    });
    observations.push({ name, status: result.status, stdout: result.stdout, stderr: result.stderr });
    fs.writeFileSync(artifact, JSON.stringify(observations, null, 2) + "\n");
    assert.ifError(result.error);
    for (const [, success, failure] of documents) {
      assert.ok(result.stdout.includes(`${populated ? "OK   " + success : "FAIL " + failure}`),
        `${name}: ${result.stdout}\n${result.stderr}`);
    }
  }
});

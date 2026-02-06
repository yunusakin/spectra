#!/usr/bin/env python3
"""
SDD Spine repository validation script.

Purpose:
- Catch broken references between indexes and rule/spec files.
- Enforce basic formatting expectations for markdown templates.
- Provide a lightweight "test" that can run in CI.

Usage:
  python3 scripts/validate-repo.py
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


RE_BACKTICKS = re.compile(r"`([^`]+)`")


@dataclass(frozen=True)
class Finding:
    level: str  # "error" | "warn"
    message: str


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Fallback for non-utf8 content; this repo should be utf-8 but don't crash.
        return path.read_text(encoding="utf-8", errors="replace")


def find_backtick_tokens(text: str) -> list[str]:
    return [m.group(1) for m in RE_BACKTICKS.finditer(text)]


def check_markdown_has_h1(path: Path) -> list[Finding]:
    text = read_text(path)
    lines = text.splitlines()
    for line in lines:
        if not line.strip():
            continue
        if line.startswith("# "):
            return []
        return [Finding("warn", f"{path}: first non-empty line should start with '# '")]
    return [Finding("warn", f"{path}: file is empty")]


def check_examples_inside_html_comments(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    text = read_text(path)
    inside_comment = False
    for idx, line in enumerate(text.splitlines(), start=1):
        if "<!--" in line:
            inside_comment = True
        if "Example:" in line and not inside_comment:
            findings.append(Finding("warn", f"{path}:{idx}: 'Example:' should be inside an HTML comment block"))
        if "-->" in line:
            inside_comment = False
    return findings


def resolve_reference_path(repo_root: Path, base_dir: Path, token: str) -> Path:
    # Allow both base-dir relative references (common in indexes) and repo-root
    # references (used in some docs like "Start here: `sdd/...`").
    p = Path(token)
    if p.is_absolute():
        return p

    base_candidate = base_dir / token
    if base_candidate.exists():
        return base_candidate

    root_candidate = repo_root / token
    return root_candidate


def check_index_backtick_paths(index_path: Path, repo_root: Path, base_dir: Path) -> list[Finding]:
    findings: list[Finding] = []
    tokens = find_backtick_tokens(read_text(index_path))
    # Filter to likely file references (avoid code ticks like `init`).
    rel_paths = [t for t in tokens if "/" in t and t.endswith(".md")]
    for rel in rel_paths:
        full = resolve_reference_path(repo_root, base_dir, rel)
        if not full.exists():
            findings.append(Finding("error", f"{index_path}: references missing file `{rel}`"))
    return findings


def parse_skill_front_matter(skill_path: Path) -> tuple[str | None, str | None, list[Finding]]:
    findings: list[Finding] = []
    text = read_text(skill_path)
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, None, [Finding("error", f"{skill_path}: missing YAML front matter (expected leading '---')")]

    # Very small YAML parser: read until second '---'
    meta: dict[str, str] = {}
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
        if not lines[i].strip():
            continue
        if ":" not in lines[i]:
            findings.append(Finding("warn", f"{skill_path}:{i+1}: malformed front matter line"))
            continue
        k, v = lines[i].split(":", 1)
        meta[k.strip()] = v.strip()

    if end_idx is None:
        findings.append(Finding("error", f"{skill_path}: YAML front matter not closed (missing second '---')"))

    name = meta.get("name")
    desc = meta.get("description")
    if not name:
        findings.append(Finding("error", f"{skill_path}: front matter missing `name`"))
    if not desc:
        findings.append(Finding("error", f"{skill_path}: front matter missing `description`"))
    return name, desc, findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors (non-zero exit).")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    findings: list[Finding] = []

    # Basic structure checks
    required_paths = [
        repo_root / "sdd/.agent/rules/index.md",
        repo_root / "sdd/memory-bank/INDEX.md",
        repo_root / "AGENT.md",
        repo_root / "AGENTS.md",
        repo_root / "CLAUDE.md",
        repo_root / ".cursorrules",
    ]
    for p in required_paths:
        if not p.exists():
            findings.append(Finding("error", f"Missing required path: {p.relative_to(repo_root)}"))

    # Validate indexes point to existing files
    rules_index = repo_root / "sdd/.agent/rules/index.md"
    if rules_index.exists():
        findings.extend(check_index_backtick_paths(rules_index, repo_root, repo_root / "sdd/.agent"))

    prompts_index = repo_root / "sdd/.agent/prompts/index.md"
    if prompts_index.exists():
        findings.extend(check_index_backtick_paths(prompts_index, repo_root, repo_root / "sdd/.agent/prompts"))

    mem_index = repo_root / "sdd/memory-bank/INDEX.md"
    if mem_index.exists():
        findings.extend(check_index_backtick_paths(mem_index, repo_root, repo_root / "sdd/memory-bank"))

    # Adapter consistency: bodies should match (ignore first line)
    adapter_paths = [
        repo_root / "AGENT.md",
        repo_root / "AGENTS.md",
        repo_root / "CLAUDE.md",
        repo_root / ".cursorrules",
    ]
    adapter_bodies: dict[str, str] = {}
    for p in adapter_paths:
        if not p.exists():
            continue
        lines = read_text(p).splitlines()
        body = "\n".join(lines[1:]).strip()
        adapter_bodies[p.name] = body
    if adapter_bodies:
        unique_bodies = {v for v in adapter_bodies.values()}
        if len(unique_bodies) != 1:
            parts = ", ".join(sorted(adapter_bodies.keys()))
            findings.append(
                Finding(
                    "error",
                    f"Adapter bodies differ (expected identical content after first line): {parts}",
                )
            )

    # Skill checks
    skills_dir = repo_root / "sdd/.agent/skills"
    skills_index = skills_dir / "index.md"
    indexed_skills: set[str] = set()
    if skills_index.exists():
        for tok in find_backtick_tokens(read_text(skills_index)):
            if "/" not in tok and "." not in tok:
                indexed_skills.add(tok)

    skill_dirs = sorted([p for p in skills_dir.iterdir() if p.is_dir()])
    for d in skill_dirs:
        skill_md = d / "SKILL.md"
        if not skill_md.exists():
            findings.append(Finding("error", f"{d.relative_to(repo_root)}: missing SKILL.md"))
            continue

        name, _desc, fm_findings = parse_skill_front_matter(skill_md)
        findings.extend(fm_findings)
        if name and name != d.name:
            findings.append(
                Finding(
                    "error",
                    f"{skill_md.relative_to(repo_root)}: front matter name '{name}' does not match directory '{d.name}'",
                )
            )
        if d.name not in indexed_skills:
            findings.append(Finding("warn", f"{d.relative_to(repo_root)}: not listed in sdd/.agent/skills/index.md"))

    # Prompt index coverage
    if prompts_index.exists():
        indexed_prompts: set[str] = set()
        for tok in find_backtick_tokens(read_text(prompts_index)):
            if "/" in tok and tok.endswith(".md"):
                indexed_prompts.add(tok)

        prompt_files = sorted(
            [
                p
                for p in (repo_root / "sdd/.agent/prompts").rglob("*.md")
                if p.name not in {"README.md", "USAGE.md", "index.md"}
            ]
        )
        for p in prompt_files:
            rel = str(p.relative_to(repo_root / "sdd/.agent/prompts"))
            if rel not in indexed_prompts:
                findings.append(Finding("warn", f"sdd/.agent/prompts/{rel}: not listed in prompts index"))

    # Markdown format checks (templates)
    for p in (repo_root / "sdd/memory-bank").rglob("*.md"):
        findings.extend(check_markdown_has_h1(p))
        findings.extend(check_examples_inside_html_comments(p))

    for p in (repo_root / "sdd/.agent/rules").rglob("*.md"):
        findings.extend(check_markdown_has_h1(p))

    # Report
    errors = [f for f in findings if f.level == "error"]
    warns = [f for f in findings if f.level == "warn"]

    if errors:
        print("Errors:")
        for f in errors:
            print(f"- {f.message}")
        print()

    if warns:
        print("Warnings:")
        for f in warns:
            print(f"- {f.message}")
        print()

    if errors or (args.strict and warns):
        print("Validation: FAIL")
        return 1

    print("Validation: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

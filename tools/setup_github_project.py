#!/usr/bin/env python3
"""Create a GitHub Projects v2 Agile board skeleton for agentic development.

This script is intentionally conservative:
- default is --dry-run
- it creates a project and fields, but does not create issues
- it requires GitHub CLI auth with the `project` scope

Examples:
  python tools/setup_github_project.py --owner @me --title "Study Companion Agentic MVP" --dry-run
  python tools/setup_github_project.py --owner @me --title "Study Companion Agentic MVP" --apply
"""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class Field:
    name: str
    data_type: str
    options: list[str] | None = None


FIELDS = [
    Field("Lane", "SINGLE_SELECT", ["Product", "Contracts", "FE", "BE", "AI", "QA", "Docs", "Workflow"]),
    Field("Type", "SINGLE_SELECT", ["Epic", "Feature", "Bug", "Review Finding", "Eval Failure", "Workflow", "Refactor", "Chore"]),
    Field("Priority", "SINGLE_SELECT", ["P0", "P1", "P2", "P3"]),
    Field("Risk", "SINGLE_SELECT", ["Low", "Medium", "High", "Critical"]),
    Field("Review Type", "SINGLE_SELECT", ["Spec", "Code", "Contract", "AI Eval", "UX", "Security", "Integration"]),
    Field("Validation", "SINGLE_SELECT", ["Not Run", "Running", "Passed", "Failed", "Waived"]),
    Field("Agent Owner", "TEXT"),
    Field("Contract Impact", "SINGLE_SELECT", ["None", "State", "API", "AI Output", "Events", "Multiple"]),
    Field("Effort", "NUMBER"),
    Field("Due", "DATE"),
]


def run(cmd: list[str], apply: bool) -> str:
    printable = " ".join(cmd)
    if not apply:
        print(f"DRY-RUN: {printable}")
        return ""
    print(f"RUN: {printable}")
    result = subprocess.run(cmd, check=True, text=True, capture_output=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    return result.stdout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", default="@me", help="GitHub owner login or @me")
    parser.add_argument("--title", default="Study Companion Agentic MVP")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True)
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    apply = bool(args.apply)

    run(["gh", "auth", "status"], apply)
    if not apply:
        print("DRY-RUN: gh auth refresh -s project  # run manually if project scope is missing")

    out = run([
        "gh", "project", "create",
        "--owner", args.owner,
        "--title", args.title,
        "--format", "json",
    ], apply)

    project_number = "<PROJECT_NUMBER>"
    if apply and out:
        data = json.loads(out)
        project_number = str(data.get("number") or data.get("project", {}).get("number") or "")
        if not project_number:
            print("Could not parse project number. Run `gh project list --owner ...` and create fields manually.")
            return 1

    for field in FIELDS:
        cmd = [
            "gh", "project", "field-create", project_number,
            "--owner", args.owner,
            "--name", field.name,
            "--data-type", field.data_type,
        ]
        if field.options:
            cmd.extend(["--single-select-options", ",".join(field.options)])
        run(cmd, apply)

    print("Done." if apply else "Dry run complete. Re-run with --apply to create the project and fields.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

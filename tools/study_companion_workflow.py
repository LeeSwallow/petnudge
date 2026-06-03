#!/usr/bin/env python3
"""Validate and render the Study Companion automation workflow.

Usage:
  python tools/study_companion_workflow.py validate
  python tools/study_companion_workflow.py render
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT / "workflow.json"
GENERATED_DIR = ROOT / "generated"

REQUIRED_STAGE_FIELDS = {"id", "role", "goal", "inputs", "outputs", "acceptance"}


def load_workflow() -> dict[str, Any]:
    with WORKFLOW_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_workflow(workflow: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not workflow.get("project"):
        errors.append("workflow.project is required")
    if not workflow.get("north_star_metric"):
        errors.append("workflow.north_star_metric is required")
    stages = workflow.get("stages")
    if not isinstance(stages, list) or not stages:
        errors.append("workflow.stages must be a non-empty list")
        return errors

    seen_ids: set[str] = set()
    for index, stage in enumerate(stages, start=1):
        missing = REQUIRED_STAGE_FIELDS - set(stage)
        if missing:
            errors.append(f"stage #{index} is missing: {', '.join(sorted(missing))}")
        stage_id = stage.get("id")
        if stage_id in seen_ids:
            errors.append(f"duplicate stage id: {stage_id}")
        if stage_id:
            seen_ids.add(stage_id)
        for field in ["inputs", "outputs", "acceptance"]:
            value = stage.get(field)
            if not isinstance(value, list) or not value:
                errors.append(f"stage {stage_id or index}.{field} must be a non-empty list")

    for context_file in workflow.get("default_context_files", []):
        if not (ROOT / context_file).exists():
            errors.append(f"default context file does not exist: {context_file}")
    return errors


def render_checklist(workflow: dict[str, Any]) -> str:
    lines = [
        "# Study Companion Workflow Checklist",
        "",
        f"Project: `{workflow['project']}`",
        f"North-star metric: `{workflow['north_star_metric']}`",
        "",
        "Use this checklist to run product refinement and MVP development in repeatable passes.",
        "",
    ]
    for i, stage in enumerate(workflow["stages"], start=1):
        lines.extend([
            f"## {i}. {stage['id']} — {stage['role']}",
            "",
            f"Goal: {stage['goal']}",
            "",
            "Inputs:",
            *[f"- [ ] `{item}`" for item in stage["inputs"]],
            "",
            "Outputs:",
            *[f"- [ ] `{item}`" for item in stage["outputs"]],
            "",
            "Acceptance:",
            *[f"- [ ] {item}" for item in stage["acceptance"]],
            "",
        ])
    return "\n".join(lines).rstrip() + "\n"


def render_prompt_pack(workflow: dict[str, Any]) -> str:
    lines = [
        "# Study Companion Agent Prompt Pack",
        "",
        "Copy one section at a time into an implementation/review agent. Keep outputs grounded in the listed input files.",
        "",
    ]
    context = ", ".join(f"`{p}`" for p in workflow.get("default_context_files", []))
    for stage in workflow["stages"]:
        lines.extend([
            f"## {stage['id']} prompt",
            "",
            f"You are the {stage['role']} for the Pixel-art AI Study Companion MVP.",
            f"Default context files: {context}.",
            "",
            f"Goal: {stage['goal']}",
            "",
            "Read these inputs before writing:",
            *[f"- {item}" for item in stage["inputs"]],
            "",
            "Produce these outputs:",
            *[f"- {item}" for item in stage["outputs"]],
            "",
            "Acceptance criteria:",
            *[f"- {item}" for item in stage["acceptance"]],
            "",
            "Report format:",
            "- Ready:",
            "- WIP:",
            "- Blockers:",
            "- Files changed:",
            "- Validation performed:",
            "",
        ])
    return "\n".join(lines).rstrip() + "\n"


def cmd_validate(_: argparse.Namespace) -> int:
    workflow = load_workflow()
    errors = validate_workflow(workflow)
    if errors:
        print("INVALID workflow")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"VALID workflow: {len(workflow['stages'])} stages")
    return 0


def cmd_render(_: argparse.Namespace) -> int:
    workflow = load_workflow()
    errors = validate_workflow(workflow)
    if errors:
        print("Cannot render invalid workflow:")
        for error in errors:
            print(f"- {error}")
        return 1
    GENERATED_DIR.mkdir(exist_ok=True)
    checklist_path = GENERATED_DIR / "workflow-checklist.md"
    prompt_pack_path = GENERATED_DIR / "agent-prompt-pack.md"
    checklist_path.write_text(render_checklist(workflow), encoding="utf-8")
    prompt_pack_path.write_text(render_prompt_pack(workflow), encoding="utf-8")
    print(f"Wrote {checklist_path.relative_to(ROOT)}")
    print(f"Wrote {prompt_pack_path.relative_to(ROOT)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(required=True)
    validate_parser = subparsers.add_parser("validate", help="validate workflow.json")
    validate_parser.set_defaults(func=cmd_validate)
    render_parser = subparsers.add_parser("render", help="generate markdown workflow artifacts")
    render_parser.set_defaults(func=cmd_render)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

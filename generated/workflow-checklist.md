# Study Companion Workflow Checklist

Project: `pixel-art-ai-study-companion`
North-star metric: `weekly_completed_focus_sessions`

Use this checklist to run product refinement and MVP development in repeatable passes.

## 1. product-pass — PM

Goal: Narrow the product into a testable MVP loop for solo study routine retention.

Inputs:
- [ ] `README.md`
- [ ] `business-evaluation.md`
- [ ] `product-spec.md`

Outputs:
- [ ] `docs/mvp-hypotheses.md`
- [ ] `docs/out-of-scope.md`

Acceptance:
- [ ] Names one narrow first target segment
- [ ] States the core user pain in one sentence
- [ ] Defines north-star and 3 supporting metrics
- [ ] Lists explicit out-of-scope items

## 2. ux-pass — UX Designer

Goal: Design the single-screen study room loop: todo, timer, character, BGM, and break-only Coffee Chat.

Inputs:
- [ ] `product-spec.md`
- [ ] `docs/mvp-hypotheses.md`

Outputs:
- [ ] `docs/ux-flow.md`
- [ ] `docs/screen-state-table.md`

Acceptance:
- [ ] Defines idle/focus/break/celebrate screen states
- [ ] Keeps AI chat muted during focus
- [ ] Specifies visible feedback after completing a session
- [ ] Includes first-session onboarding copy

## 3. architecture-pass — Tech Lead

Goal: Define the smallest implementation architecture for a working web MVP.

Inputs:
- [ ] `product-spec.md`
- [ ] `docs/ux-flow.md`

Outputs:
- [ ] `docs/architecture.md`
- [ ] `docs/state-schema.json`

Acceptance:
- [ ] Defines app state fields for tasks, timer, companion, rewards, and chat
- [ ] Separates AI provider interface from UI state
- [ ] Includes local-storage or backend persistence decision
- [ ] Includes degraded behavior when AI is unavailable

## 4. backlog-pass — Engineering Planner

Goal: Break the MVP into small implementation tasks with verification steps.

Inputs:
- [ ] `docs/architecture.md`
- [ ] `docs/state-schema.json`
- [ ] `docs/ux-flow.md`

Outputs:
- [ ] `docs/implementation-backlog.md`

Acceptance:
- [ ] Every task is independently testable
- [ ] Every task lists files to create or modify
- [ ] Every task has a manual or automated verification command
- [ ] No task depends on undefined product behavior

## 5. build-pass — Developer

Goal: Implement the MVP incrementally and verify after each task.

Inputs:
- [ ] `docs/implementation-backlog.md`

Outputs:
- [ ] `working MVP`
- [ ] `validation log`

Acceptance:
- [ ] Timer can complete at least one focus session
- [ ] Coffee Chat appears only during break
- [ ] EXP/streak changes after session completion
- [ ] Core loop can be demonstrated without seeded fake progress

## 6. validation-pass — QA/Reviewer

Goal: Decide whether the increment is demo-ready, WIP, or blocked.

Inputs:
- [ ] `running app`
- [ ] `docs/implementation-backlog.md`
- [ ] `product-spec.md`

Outputs:
- [ ] `docs/validation-report.md`

Acceptance:
- [ ] Reports ready vs WIP vs blockers separately
- [ ] Checks the first-session user journey end to end
- [ ] Flags placeholder visuals or inert UI
- [ ] Records exact commands and observed results

## 7. github-orchestration-pass — Orchestrator

Goal: Turn the MVP plan into GitHub issues, lane labels, PR gates, and self-improvement loops.

Inputs:
- [ ] `github-orchestration-blueprint.md`
- [ ] `docs/contracts.md`
- [ ] `workflow.json`

Outputs:
- [ ] `GitHub labels`
- [ ] `GitHub issues`
- [ ] `PR templates`
- [ ] `validation/review loop`

Acceptance:
- [ ] Defines FE/BE/AI/Contracts/QA lane ownership
- [ ] Every issue has lane, acceptance criteria, and validation command
- [ ] Every PR links an issue and reports validation results
- [ ] CI/eval/review failures are converted into follow-up issues
- [ ] Repeated failures update docs, evals, or shared libraries

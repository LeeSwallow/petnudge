# GitHub Labels for Study Companion

Create these labels once the folder becomes a GitHub repo.

```bash
gh label create "lane:fe" --color "1f77b4" --description "Frontend/UI work"
gh label create "lane:be" --color "2ca02c" --description "Backend/API/data work"
gh label create "lane:ai" --color "9467bd" --description "AI prompts/provider/evals"
gh label create "lane:contracts" --color "ff7f0e" --description "Shared contracts/schemas/API boundaries"
gh label create "lane:qa" --color "d62728" --description "QA, E2E, validation"
gh label create "lane:docs" --color "7f7f7f" --description "Docs/workflow"

gh label create "type:feature" --color "0e8a16" --description "Feature work"
gh label create "type:bug" --color "b60205" --description "Bug fix"
gh label create "type:review-finding" --color "fbca04" --description "Finding from review"
gh label create "type:eval-failure" --color "5319e7" --description "AI/eval failure"
gh label create "type:workflow" --color "c2e0c6" --description "Automation/workflow improvement"

gh label create "priority:p0" --color "b60205" --description "Immediate blocker"
gh label create "priority:p1" --color "d93f0b" --description "Important"
gh label create "priority:p2" --color "fbca04" --description "Normal"

gh label create "status:needs-triage" --color "ededed" --description "Needs orchestrator triage"
gh label create "status:ready" --color "0e8a16" --description "Ready to implement"
gh label create "status:blocked" --color "b60205" --description "Blocked"
gh label create "status:in-review" --color "0052cc" --description "PR under review"
gh label create "status:validated" --color "5319e7" --description "Validation passed"
```

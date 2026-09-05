# AgentOps

**AgentOps** is an AI-powered QA, software engineering, and DevOps automation platform. The goal is simple: give AgentOps a high-level command and let it safely plan, inspect, test, diagnose, fix, deploy, verify, and report — while keeping humans in control of consequential actions.

> **Core principle:** autonomous where safe, approval-gated where consequential.

## Target Workflow

```text
User Command
    ↓
AI Planner / Orchestrator
    ↓
Repository + Browser + Runtime Inspection
    ↓
QA + Security + Root-Cause Analysis
    ↓
Code Fix + Tests + Pull Request
    ↓
Preview Deployment
    ↓
Browser Regression QA
    ↓
Human Approval
    ↓
Production Deployment
    ↓
Monitoring + Audit Trail
```

# Master Roadmap — 35 Capabilities / 5 Phases

## Phase 1 — Core Platform & Safe Browser QA

Build the secure browser and QA foundation first.

1. **AI Brain / Planner** — convert a user goal into a bounded executable plan.
2. **Autonomous Browser Control** — navigate, click, type, scroll, select, upload, and interact with web apps.
3. **Website Auto Exploration** — discover pages, forms, navigation, and important user flows.
4. **Automatic Test Generation** — generate tests from the application and user goal.
5. **Functional QA Testing** — verify expected application behavior and business flows.
6. **Visual QA** — detect broken layouts, missing elements, overflow, and responsive UI problems.
7. **Console & Network Monitoring** — capture JavaScript errors, failed requests, API errors, and abnormal responses.

### Phase 1 Checklist

- [ ] Natural-language goal becomes bounded execution steps
- [ ] One unified browser execution engine
- [ ] Private/internal network access blocked by default
- [ ] Browser sessions isolated between tasks
- [ ] Agent can explore a test site without predefined selectors
- [ ] Functional tests can be generated automatically
- [ ] Desktop/mobile visual checks work
- [ ] Console and network failures are captured
- [ ] Timeouts, retries, and maximum-step limits enforced
- [ ] Phase 1 security review passed

**Exit:** AgentOps can safely explore and test a website and produce reliable evidence without changing source code or production infrastructure.

---

## Phase 2 — Bug Intelligence, GitHub & Automated Fixing

Turn QA findings into reviewable engineering work.

### Phase 2 Build Plan

- **P2.1** Evidence + Bug Model
- **P2.2** Severity Classifier
- **P2.3** AI Root-Cause Analyzer
- **P2.4** GitHub Connector Foundation
- **P2.5** Repo Read/Search + Task Branch Workflow
- **P2.6** AI Code Fix Engine
- **P2.7** Automated Test Runner
- **P2.8** Commit + Pull Request + CI Integration
- **P2.9** Bounded Self-Fixing Loop (max 3 attempts)
- **P2.10** Security Hardening + Final Phase-2 Integration

**Phase 2 target flow:** `QA Fail → Evidence → Severity → Root Cause → Repo Inspect → Task Branch → Fix → Tests → Commit → PR → CI → Retest → Success / Retry / Escalate`

**Phase 2 guardrails:** never push fixes directly to `main`, never auto-merge PRs, keep secrets out of model context/logs, use bounded retries, and escalate failed autofix attempts to a human.

8. **Screenshot / Evidence Capture** — attach screenshots and technical evidence to failures.
9. **Bug Severity Classification** — classify findings as Critical, High, Medium, or Low.
10. **AI Root-Cause Analysis** — correlate browser failures, logs, network errors, and source code.
11. **GitHub Integration** — read/search repos, create branches, commits and PRs, and inspect CI.
12. **AI Code Fixing** — generate focused code changes for confirmed problems.
13. **Automated Test Execution** — run unit, integration, and browser tests after changes.
14. **Self-Fixing Loop** — find → diagnose → fix → test → retry within strict attempt limits.

### Phase 2 Checklist

- [ ] Every bug has reproducible evidence
- [ ] Severity follows documented rules
- [ ] Root-cause analysis links findings to relevant code/logs
- [ ] GitHub uses least-privilege credentials
- [ ] Agent never pushes directly to protected `main`
- [ ] Every change uses a task branch
- [ ] Changes are presented through pull requests
- [ ] Tests run before a fix is accepted
- [ ] Autofix attempts have a hard maximum
- [ ] Failed autofixes escalate to a human
- [ ] Phase 2 security review passed

**Exit:** AgentOps can discover a bug, implement a bounded fix, test it, and present it through a reviewable pull request.

---

## Phase 3 — Deployment, Rollback & Human Control

Add deployment authority through provider adapters and strict safety gates.

15. **Preview Deployment** — deploy branches/PRs to preview or staging environments.
16. **Deployment Log Analysis** — inspect build/runtime logs and diagnose failures.
17. **Post-Deployment QA** — automatically test the deployed preview URL.
18. **Production Deployment** — promote verified releases through the configured approval policy.
19. **Rollback System** — restore a previous known-good release when necessary.
20. **Human Approval System** — require approval for consequential actions.
21. **Permission Engine** — classify actions as Safe, Restricted, or Critical and enforce policy.

Initial deployment integrations: **Render, Vercel, Netlify**.

### Phase 3 Checklist

- [ ] Preview deployments use a common provider interface
- [ ] Deployment status tracked end-to-end
- [ ] Build/runtime logs available to diagnostic agent
- [ ] Preview URLs automatically enter QA pipeline
- [ ] Failed preview QA blocks production promotion
- [ ] Production deployment requires configured approval
- [ ] Rollback tested before production autonomy is enabled
- [ ] Destructive actions cannot bypass permission engine
- [ ] Approval request shows action, target, risk, and expected effect
- [ ] Every deployment/approval decision is auditable
- [ ] Phase 3 security review passed

**Exit:** AgentOps can safely take a change from PR → preview → verification → human-approved production deployment, with rollback capability.

---

## Phase 4 — Security, Credentials, Database & Continuous Operations

Prepare AgentOps for persistent real-world operation.

22. **Credential Vault** — keep GitHub/provider/API credentials outside prompts, logs, and normal application data.
23. **Security Scanner** — detect exposed secrets, vulnerable dependencies, dangerous patterns, and common web security problems.
24. **Database Agent** — inspect schemas and prepare controlled DB changes; destructive actions require approval.
25. **Scheduled QA** — run configured QA suites hourly, daily, weekly, or on approved schedules.
26. **Monitoring Agent** — monitor production health and important failures.
27. **Email / Telegram Notifications** — deliver failures, deployment results, and approval requests.
28. **Detailed AI Reports** — explain tests, failures, evidence, likely cause, and recommended action.

### Phase 4 Checklist

- [ ] Raw provider tokens are not exposed to the model unnecessarily
- [ ] Secrets encrypted and scoped per integration
- [ ] Logs/reports redact passwords, tokens, cookies, and sensitive values
- [ ] Dependency and secret scanning automated
- [ ] Database changes support plan/dry-run
- [ ] Destructive DB operations require explicit approval
- [ ] Scheduled jobs cannot overlap uncontrollably
- [ ] Production monitoring has sensible alert thresholds
- [ ] Notifications do not leak secrets
- [ ] Reports contain evidence and actionable remediation
- [ ] Phase 4 security review passed

**Exit:** AgentOps can operate continuously with protected credentials, controlled DB access, scheduled QA, monitoring, notifications, and useful reports.

---

## Phase 5 — Control Center, Multi-Agent Intelligence & Production Guardrails

Complete the platform with governance, specialized agents, history, and operational controls.

29. **Complete Audit Log** — record requested, planned, approved, changed, tested, and deployed actions.
30. **Multi-Agent System** — coordinate Orchestrator, QA, Coding, Security, and DevOps agents.
31. **Project Memory / Context** — retain safe project architecture, decisions, test history, and issue context.
32. **Command Center Dashboard** — manage projects, agents, tasks, runs, issues, deployments, approvals, integrations, and reports.
33. **Emergency Stop / Kill Switch** — immediately stop active agent work and prevent new high-impact actions.
34. **Cost / Usage Limits** — enforce project/task budgets for AI, browser, API, and deployment usage.
35. **Retry & Safety Limits** — prevent infinite loops, repeated deployments, and uncontrolled tool execution.

### Phase 5 Checklist

- [ ] Important actions appear in an auditable event history
- [ ] Specialized agents have separate roles and tool permissions
- [ ] Orchestrator cannot bypass approval/security policies
- [ ] Project memory has retention and sensitivity rules
- [ ] Dashboard shows live task state and pending approvals
- [ ] Kill switch stops active execution quickly
- [ ] Per-task and per-project cost limits enforced
- [ ] Retry budgets enforced across the workflow
- [ ] Agent safely recovers from partial failures
- [ ] Production readiness/security review passed
- [ ] Full end-to-end acceptance test passed

**Exit:** AgentOps becomes a controlled AI QA + Engineering + DevOps platform with multi-agent execution, governance, observability, budgets, and human authority over critical actions.

---

# Permission Model

| Level | Examples | Default Policy |
|---|---|---|
| 🟢 Safe | Read repo, inspect logs, browse test site, read-only QA | Automatic |
| 🟡 Restricted | Create branch, edit code, open PR, preview deploy | Policy-controlled |
| 🔴 Critical | Production deploy, destructive DB migration, delete resources, secret/security changes | Human approval required |

# Target Multi-Agent Architecture

```text
                    User
                      ↓
                Orchestrator
                      ↓
          Policy / Approval Engine
                      ↓
     ┌────────────────┼────────────────┐
     ↓                ↓                ↓
  QA Agent       Coding Agent    Security Agent
     │                │                │
     └────────────────┼────────────────┘
                      ↓
                 DevOps Agent
                      ↓
       Preview → QA → Approval → Prod
```

# Definition of Done

AgentOps reaches its initial production target when a user can give a bounded instruction such as:

> Inspect this project, create a preview deployment, test the important user flows, diagnose confirmed failures, prepare safe fixes in a pull request, redeploy the preview, retest it, and ask for approval before production.

The workflow must remain traceable, use scoped credentials, enforce bounded retries/costs, and never perform an unapproved critical action.

## Development Rule

> **Do not start the next phase until the current phase checklist and security review are complete.**

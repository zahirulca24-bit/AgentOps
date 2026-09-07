import { 
  pgTable, 
  uuid, 
  varchar, 
  timestamp, 
  text, 
  integer, 
  pgEnum,
  index,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const taskStatusEnum = pgEnum('task_status', ['pending', 'running', 'completed', 'failed']);
export const runStatusEnum = pgEnum('run_status', ['pending', 'running', 'passed', 'completed', 'failed', 'error', 'stopped', 'aborted']);
export const stepStatusEnum = pgEnum('step_status', ['pending', 'running', 'completed', 'failed', 'skipped']);
export const browserSessionStatusEnum = pgEnum('browser_session_status', ['active', 'closed', 'crashed']);
export const testResultStatusEnum = pgEnum('test_result_status', ['pending', 'running', 'passed', 'failed', 'error', 'stopped', 'skipped']);
export const issueSeverityEnum = pgEnum('issue_severity', ['critical', 'high', 'medium', 'low']);
export const issueStatusEnum = pgEnum('issue_status', ['open', 'investigating', 'fixed', 'closed']);

// Tables
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  targetUrl: varchar('target_url', { length: 2048 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    createdAtIndex: index('project_created_at_idx').on(table.createdAt),
  };
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  command: text('command').notNull(),
  targetUrl: varchar('target_url', { length: 2048 }),
  status: taskStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectIdIndex: index('task_project_id_idx').on(table.projectId),
    statusIndex: index('task_status_idx').on(table.status),
  };
});

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  status: runStatusEnum('status').notNull().default('running'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    taskIdIndex: index('run_task_id_idx').on(table.taskId),
    statusIndex: index('run_status_idx').on(table.status),
  };
});

export const runSteps = pgTable('run_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  status: stepStatusEnum('status').notNull().default('pending'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => {
  return {
    runIdIndex: index('step_run_id_idx').on(table.runId),
  };
});

export const browserSessions = pgTable('browser_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  status: browserSessionStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    runIdIdx: index('browser_sessions_run_id_idx').on(table.runId),
  };
});

// B9: Structured QA Test Cases
export const testCases = pgTable('test_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  preconditions: text('preconditions'),
  steps: jsonb('steps').notNull(),
  assertions: jsonb('assertions').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    runIdIdx: index('test_cases_run_id_idx').on(table.runId),
  };
});

export const testResults = pgTable('test_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  testCaseId: uuid('test_case_id').references(() => testCases.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: testResultStatusEnum('status').notNull().default('pending'),
  durationMs: integer('duration_ms'),
  summary: text('summary'),
  errorMessage: text('error_message'),
  screenshotRef: varchar('screenshot_ref', { length: 1024 }),
  assertions: jsonb('assertions'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    runIdIndex: index('test_run_id_idx').on(table.runId),
    statusIndex: index('test_status_idx').on(table.status),
  };
});

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  testResultId: uuid('test_result_id').references(() => testResults.id, { onDelete: 'set null' }),
  browserSessionId: uuid('browser_session_id').references(() => browserSessions.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  severity: issueSeverityEnum('severity').notNull(),
  severityReason: text('severity_reason'),
  category: varchar('category', { length: 100 }),
  status: issueStatusEnum('status').notNull().default('open'),
  reproductionSteps: jsonb('reproduction_steps'),
  expectedResult: text('expected_result'),
  actualResult: text('actual_result'),
  screenshotEvidence: jsonb('screenshot_evidence'),
  consoleEvidence: jsonb('console_evidence'),
  networkEvidence: jsonb('network_evidence'),
  affectedUrl: varchar('affected_url', { length: 2048 }),
  rootCauseAnalysis: jsonb('root_cause_analysis'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    runIdIndex: index('issue_run_id_idx').on(table.runId),
    testResultIdIndex: index('issue_test_result_id_idx').on(table.testResultId),
    browserSessionIdIndex: index('issue_browser_session_id_idx').on(table.browserSessionId),
    severityIndex: index('issue_severity_idx').on(table.severity),
    statusIndex: index('issue_status_idx').on(table.status),
  };
});

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  testResultId: uuid('test_result_id').references(() => testResults.id, { onDelete: 'set null' }),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(),
  storageRef: varchar('storage_ref', { length: 2048 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    runIdIndex: index('evidence_run_id_idx').on(table.runId),
  };
});

// Persist only a vault/secret-manager reference. Raw GitHub tokens must never be stored in the application database.
export const githubConfigs = pgTable('github_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  owner: varchar('owner', { length: 255 }).notNull(),
  repo: varchar('repo', { length: 255 }).notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
  tokenRef: varchar('token_ref', { length: 512 }),
  baseUrl: varchar('base_url', { length: 2048 }).notNull().default('https://api.github.com'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectIdIndex: index('github_configs_project_id_idx').on(table.projectId),
  };
});

export const previewDeployments = pgTable('preview_deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  branchName: varchar('branch_name', { length: 255 }).notNull(),
  prNumber: integer('pr_number'),
  status: varchar('status', { length: 50 }).notNull().default('building'),
  previewUrl: varchar('preview_url', { length: 2048 }),
  logsUrl: varchar('logs_url', { length: 2048 }),
  buildLogs: text('build_logs'),
  errorDetails: text('error_details'),
  logAnalysis: jsonb('log_analysis'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectIdIdx: index('preview_deployments_project_id_idx').on(table.projectId),
    runIdIdx: index('preview_deployments_run_id_idx').on(table.runId),
    branchNameIdx: index('preview_deployments_branch_name_idx').on(table.branchName),
  };
});

export const productionDeployments = pgTable('production_deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  previewDeploymentId: uuid('preview_deployment_id').references(() => previewDeployments.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  branchName: varchar('branch_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending_approval'),
  approvalStatus: varchar('approval_status', { length: 50 }).notNull().default('pending'),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  productionUrl: varchar('production_url', { length: 2048 }),
  logsUrl: varchar('logs_url', { length: 2048 }),
  buildLogs: text('build_logs'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    previewDeploymentIdIdx: index('production_deployments_preview_id_idx').on(table.previewDeploymentId),
    approvalStatusIdx: index('production_deployments_approval_status_idx').on(table.approvalStatus),
  };
});

export const deploymentRollbacks = pgTable('deployment_rollbacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetProductionId: uuid('target_production_id').references(() => productionDeployments.id, { onDelete: 'cascade' }),
  restoredProductionId: uuid('restored_production_id').references(() => productionDeployments.id, { onDelete: 'set null' }),
  mode: varchar('mode', { length: 50 }).notNull().default('automatic'), // 'automatic' | 'manual'
  status: varchar('status', { length: 50 }).notNull().default('initiated'), // 'initiated' | 'restoring' | 'restored' | 'failed'
  rollbackReason: text('rollback_reason').notNull(),
  initiatedBy: varchar('initiated_by', { length: 255 }),
  approvedBy: varchar('approved_by', { length: 255 }),
  restoredUrl: varchar('restored_url', { length: 2048 }),
  rollbackLogs: text('rollback_logs'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    targetProductionIdIdx: index('deployment_rollbacks_target_id_idx').on(table.targetProductionId),
  };
});

export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionCategory: varchar('action_category', { length: 100 }).notNull(), // 'PRODUCTION_DEPLOYMENT' | 'MANUAL_ROLLBACK' | 'DATABASE_MIGRATION' | 'SECURITY_CREDENTIAL_ROTATION' | 'DESTRUCTIVE_INFRA_ACTION'
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'expired'
  resourceId: varchar('resource_id', { length: 255 }),
  actionSummary: text('action_summary').notNull(),
  requestedBy: varchar('requested_by', { length: 255 }).notNull(),
  approvedBy: varchar('approved_by', { length: 255 }),
  reason: text('reason'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    actionCategoryIdx: index('approval_requests_category_idx').on(table.actionCategory),
    statusIdx: index('approval_requests_status_idx').on(table.status),
  };
});

export const permissionDecisions = pgTable('permission_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 255 }).notNull(),
  tier: varchar('tier', { length: 20 }).notNull(), // 'Green' | 'Yellow' | 'Red'
  decision: varchar('decision', { length: 50 }).notNull(), // 'allow' | 'policy_approval_required' | 'human_approval_required' | 'deny'
  actor: varchar('actor', { length: 255 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  reason: text('reason'),
  evaluatedAt: timestamp('evaluated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    actionIdx: index('permission_decisions_action_idx').on(table.action),
    tierIdx: index('permission_decisions_tier_idx').on(table.tier),
  };
});




// Relationships
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  githubConfigs: many(githubConfigs),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  runs: many(runs),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  task: one(tasks, {
    fields: [runs.taskId],
    references: [tasks.id],
  }),
  runSteps: many(runSteps),
  browserSessions: many(browserSessions),
  testResults: many(testResults),
  issues: many(issues),
  evidence: many(evidence),
}));

export const runStepsRelations = relations(runSteps, ({ one }) => ({
  run: one(runs, {
    fields: [runSteps.runId],
    references: [runs.id],
  }),
}));

export const browserSessionsRelations = relations(browserSessions, ({ one }) => ({
  run: one(runs, {
    fields: [browserSessions.runId],
    references: [runs.id],
  }),
}));

export const testResultsRelations = relations(testResults, ({ one, many }) => ({
  run: one(runs, {
    fields: [testResults.runId],
    references: [runs.id],
  }),
  evidence: many(evidence),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  run: one(runs, {
    fields: [issues.runId],
    references: [runs.id],
  }),
  testResult: one(testResults, {
    fields: [issues.testResultId],
    references: [testResults.id],
  }),
  browserSession: one(browserSessions, {
    fields: [issues.browserSessionId],
    references: [browserSessions.id],
  }),
  evidence: many(evidence),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  run: one(runs, {
    fields: [evidence.runId],
    references: [runs.id],
  }),
  testResult: one(testResults, {
    fields: [evidence.testResultId],
    references: [testResults.id],
  }),
  issue: one(issues, {
    fields: [evidence.issueId],
    references: [issues.id],
  }),
}));

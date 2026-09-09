import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from '../../infrastructure/db/schema.js';

export const browserWorkers = pgTable('browser_workers', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  environment: varchar('environment', { length: 64 }).notNull().default('test'),
  targetUrl: varchar('target_url', { length: 2048 }).notNull(),
  scheduleType: varchar('schedule_type', { length: 32 }).notNull().default('on_demand'),
  status: varchar('status', { length: 32 }).notNull().default('idle'),
  currentAction: varchar('current_action', { length: 512 }).notNull().default('Waiting for dispatch'),
  credentialSecretRef: varchar('credential_secret_ref', { length: 255 }),
  loginConfig: jsonb('login_config'),
  workflow: jsonb('workflow').notNull().default([]),
  lastRunId: uuid('last_run_id'),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('browser_workers_project_idx').on(table.projectId),
  statusIdx: index('browser_workers_status_idx').on(table.status),
  nextRunIdx: index('browser_workers_next_run_idx').on(table.nextRunAt),
}));

export const browserWorkerRuns = pgTable('browser_worker_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => browserWorkers.id, { onDelete: 'cascade' }),
  trigger: varchar('trigger', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('running'),
  currentAction: varchar('current_action', { length: 512 }).notNull().default('Starting browser session'),
  summary: text('summary'),
  metrics: jsonb('metrics'),
  comparison: jsonb('comparison'),
  report: jsonb('report'),
  importantFailure: boolean('important_failure').notNull().default(false),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  workerIdx: index('browser_worker_runs_worker_idx').on(table.workerId),
  statusIdx: index('browser_worker_runs_status_idx').on(table.status),
  startedIdx: index('browser_worker_runs_started_idx').on(table.startedAt),
}));

export const browserWorkerNotifications = pgTable('browser_worker_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => browserWorkers.id, { onDelete: 'cascade' }),
  workerRunId: uuid('worker_run_id').references(() => browserWorkerRuns.id, { onDelete: 'cascade' }),
  severity: varchar('severity', { length: 32 }).notNull().default('high'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  workerIdx: index('browser_worker_notifications_worker_idx').on(table.workerId),
  readIdx: index('browser_worker_notifications_read_idx').on(table.readAt),
  createdIdx: index('browser_worker_notifications_created_idx').on(table.createdAt),
}));

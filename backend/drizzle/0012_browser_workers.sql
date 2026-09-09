CREATE TABLE IF NOT EXISTS "browser_workers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "environment" varchar(64) DEFAULT 'test' NOT NULL,
  "target_url" varchar(2048) NOT NULL,
  "schedule_type" varchar(32) DEFAULT 'on_demand' NOT NULL,
  "status" varchar(32) DEFAULT 'idle' NOT NULL,
  "current_action" varchar(512) DEFAULT 'Waiting for dispatch' NOT NULL,
  "credential_secret_ref" varchar(255),
  "login_config" jsonb,
  "workflow" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_run_id" uuid,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "browser_worker_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "worker_id" uuid NOT NULL REFERENCES "browser_workers"("id") ON DELETE cascade,
  "trigger" varchar(32) NOT NULL,
  "status" varchar(32) DEFAULT 'running' NOT NULL,
  "current_action" varchar(512) DEFAULT 'Starting browser session' NOT NULL,
  "summary" text,
  "metrics" jsonb,
  "comparison" jsonb,
  "report" jsonb,
  "important_failure" boolean DEFAULT false NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "browser_worker_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "worker_id" uuid NOT NULL REFERENCES "browser_workers"("id") ON DELETE cascade,
  "worker_run_id" uuid REFERENCES "browser_worker_runs"("id") ON DELETE cascade,
  "severity" varchar(32) DEFAULT 'high' NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "browser_workers_project_idx" ON "browser_workers" ("project_id");
CREATE INDEX IF NOT EXISTS "browser_workers_status_idx" ON "browser_workers" ("status");
CREATE INDEX IF NOT EXISTS "browser_workers_next_run_idx" ON "browser_workers" ("next_run_at");
CREATE INDEX IF NOT EXISTS "browser_worker_runs_worker_idx" ON "browser_worker_runs" ("worker_id");
CREATE INDEX IF NOT EXISTS "browser_worker_runs_status_idx" ON "browser_worker_runs" ("status");
CREATE INDEX IF NOT EXISTS "browser_worker_runs_started_idx" ON "browser_worker_runs" ("started_at");
CREATE INDEX IF NOT EXISTS "browser_worker_notifications_worker_idx" ON "browser_worker_notifications" ("worker_id");
CREATE INDEX IF NOT EXISTS "browser_worker_notifications_read_idx" ON "browser_worker_notifications" ("read_at");
CREATE INDEX IF NOT EXISTS "browser_worker_notifications_created_idx" ON "browser_worker_notifications" ("created_at");

-- Database-level overlap guard: a worker can have at most one active run, even across scheduler processes.
CREATE UNIQUE INDEX IF NOT EXISTS "browser_worker_runs_one_running_idx"
  ON "browser_worker_runs" ("worker_id")
  WHERE "status" = 'running';

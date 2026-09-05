CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"preconditions" text,
	"steps" jsonb NOT NULL,
	"assertions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "session_run_id_idx";--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_cases_run_id_idx" ON "test_cases" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "browser_sessions_run_id_idx" ON "browser_sessions" USING btree ("run_id");
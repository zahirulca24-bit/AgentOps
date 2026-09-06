ALTER TYPE "public"."issue_status" ADD VALUE 'investigating';--> statement-breakpoint
ALTER TYPE "public"."issue_status" ADD VALUE 'fixed';--> statement-breakpoint
ALTER TYPE "public"."issue_status" ADD VALUE 'closed';--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "test_result_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "browser_session_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "reproduction_steps" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "expected_result" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "actual_result" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "screenshot_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "console_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "network_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_test_result_id_test_results_id_fk" FOREIGN KEY ("test_result_id") REFERENCES "public"."test_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_browser_session_id_browser_sessions_id_fk" FOREIGN KEY ("browser_session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_test_result_id_idx" ON "issues" USING btree ("test_result_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_browser_session_id_idx" ON "issues" USING btree ("browser_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_status_idx" ON "issues" USING btree ("status");

ALTER TYPE "public"."run_status" ADD VALUE 'pending' BEFORE 'running';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'passed' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'error' BEFORE 'aborted';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'stopped' BEFORE 'aborted';--> statement-breakpoint
ALTER TYPE "public"."test_result_status" ADD VALUE 'pending' BEFORE 'passed';--> statement-breakpoint
ALTER TYPE "public"."test_result_status" ADD VALUE 'running' BEFORE 'passed';--> statement-breakpoint
ALTER TYPE "public"."test_result_status" ADD VALUE 'error' BEFORE 'skipped';--> statement-breakpoint
ALTER TYPE "public"."test_result_status" ADD VALUE 'stopped' BEFORE 'skipped';--> statement-breakpoint
ALTER TABLE "test_results" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "test_results" ADD COLUMN "test_case_id" uuid;--> statement-breakpoint
ALTER TABLE "test_results" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "test_results" ADD COLUMN "screenshot_ref" varchar(1024);--> statement-breakpoint
ALTER TABLE "test_results" ADD COLUMN "assertions" jsonb;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE set null ON UPDATE no action;
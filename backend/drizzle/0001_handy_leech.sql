CREATE INDEX "session_run_id_idx" ON "browser_sessions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "evidence_run_id_idx" ON "evidence" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "issue_run_id_idx" ON "issues" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "issue_severity_idx" ON "issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "project_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "step_run_id_idx" ON "run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_task_id_idx" ON "runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "run_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "test_run_id_idx" ON "test_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "test_status_idx" ON "test_results" USING btree ("status");
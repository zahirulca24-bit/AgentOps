CREATE TABLE IF NOT EXISTS "preview_deployments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid,
  "provider" varchar(50) NOT NULL,
  "branch_name" varchar(255) NOT NULL,
  "pr_number" integer,
  "status" varchar(50) DEFAULT 'building' NOT NULL,
  "preview_url" varchar(2048),
  "logs_url" varchar(2048),
  "build_logs" text,
  "error_details" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "preview_deployments_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "preview_deployments_project_id_idx" ON "preview_deployments" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "preview_deployments_branch_name_idx" ON "preview_deployments" USING btree ("branch_name");

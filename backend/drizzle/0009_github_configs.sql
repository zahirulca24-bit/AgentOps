CREATE TABLE IF NOT EXISTS "github_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid REFERENCES "projects"("id") ON DELETE cascade,
	"owner" varchar(255) NOT NULL,
	"repo" varchar(255) NOT NULL,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"token" text NOT NULL,
	"base_url" varchar(2048) DEFAULT 'https://api.github.com' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "github_configs_project_id_idx" ON "github_configs" ("project_id");

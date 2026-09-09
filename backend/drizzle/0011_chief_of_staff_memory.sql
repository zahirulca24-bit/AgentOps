CREATE TABLE IF NOT EXISTS "agent_memory_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(64) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_memory_kind_idx" ON "agent_memory_entries" USING btree ("kind");
CREATE INDEX IF NOT EXISTS "agent_memory_created_idx" ON "agent_memory_entries" USING btree ("created_at");
CREATE TABLE IF NOT EXISTS "agent_communication_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "speaker" varchar(255) NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "agent" varchar(64),
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_communication_created_idx" ON "agent_communication_logs" USING btree ("created_at");

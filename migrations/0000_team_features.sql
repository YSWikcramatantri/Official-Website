ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'solo' NOT NULL;
ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "team_id" varchar;
--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "solo_registration_open" boolean DEFAULT true;
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "team_registration_open" boolean DEFAULT true;
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "registration_open";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"join_code" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "teams_join_code_unique" UNIQUE("join_code")
);

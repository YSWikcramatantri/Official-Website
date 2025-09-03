ALTER TABLE "participants" ADD COLUMN "institution" text NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "registration_open" boolean DEFAULT true;
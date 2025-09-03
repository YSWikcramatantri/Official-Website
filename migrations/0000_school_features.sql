CREATE TABLE "participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"passcode" text NOT NULL,
	"has_completed_quiz" boolean DEFAULT false,
	"registered_at" timestamp DEFAULT now(),
	"mode" text DEFAULT 'solo' NOT NULL,
	"school_id" varchar,
	"subject" text,
	"is_leader" boolean DEFAULT false,
	CONSTRAINT "participants_passcode_unique" UNIQUE("passcode")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"options" json NOT NULL,
	"correct_answer" text NOT NULL,
	"time_limit" integer NOT NULL,
	"marks" integer NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" varchar NOT NULL,
	"answers" json NOT NULL,
	"score" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'system' NOT NULL,
	"solo_registration_open" boolean DEFAULT true,
	"school_registration_open" boolean DEFAULT true,
	"quiz_active" boolean DEFAULT true,
	"admin_password" text DEFAULT 'admin123' NOT NULL
);

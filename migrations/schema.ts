import { pgTable, unique, varchar, text, boolean, timestamp, json, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const participants = pgTable("participants", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	institution: text().notNull(),
	passcode: text().notNull(),
	hasCompletedQuiz: boolean("has_completed_quiz").default(false),
	registeredAt: timestamp("registered_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("participants_email_unique").on(table.email),
	unique("participants_passcode_key").on(table.passcode),
]);

export const quizSubmissions = pgTable("quiz_submissions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	participantId: varchar("participant_id").notNull(),
	answers: json().notNull(),
	score: integer().notNull(),
	totalMarks: integer("total_marks").notNull(),
	timeTaken: integer("time_taken").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow(),
});

export const questions = pgTable("questions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	text: text().notNull(),
	options: json().notNull(),
	correctAnswer: text("correct_answer").notNull(),
	timeLimit: integer("time_limit").notNull(),
	marks: integer().notNull(),
	orderIndex: integer("order_index").notNull(),
	subject: text().default('General Astronomy').notNull(),
});

export const systemSettings = pgTable("system_settings", {
	id: varchar().default('system').primaryKey().notNull(),
	registrationOpen: boolean("registration_open").default(true),
	quizActive: boolean("quiz_active").default(true),
	adminPassword: text("admin_password").default('admin123').notNull(),
	quizMode: text("quiz_mode").default('solo').notNull(),
});

export const teams = pgTable("teams", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	institution: text().notNull(),
	captainId: varchar("captain_id").notNull(),
	registeredAt: timestamp("registered_at", { mode: 'string' }).defaultNow(),
});

export const teamMembers = pgTable("team_members", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	teamId: varchar("team_id").notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	subject: text().notNull(),
	passcode: text().notNull(),
	hasCompletedQuiz: boolean("has_completed_quiz").default(false),
	registeredAt: timestamp("registered_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("team_members_email_key").on(table.email),
	unique("team_members_passcode_key").on(table.passcode),
]);

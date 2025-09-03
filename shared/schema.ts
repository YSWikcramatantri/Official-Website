import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const participants = pgTable("participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  institution: text("institution").notNull(),
  passcode: text("passcode").notNull().unique(),
  hasCompletedQuiz: boolean("has_completed_quiz").default(false),
  registeredAt: timestamp("registered_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  options: json("options").notNull().$type<{ A: string; B: string; C: string; D: string }>(),
  correctAnswer: text("correct_answer").notNull(),
  timeLimit: integer("time_limit").notNull(),
  marks: integer("marks").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const quizSubmissions = pgTable("quiz_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  participantId: varchar("participant_id").notNull(),
  answers: json("answers").notNull().$type<Record<string, string>>(),
  score: integer("score").notNull(),
  totalMarks: integer("total_marks").notNull(),
  timeTaken: integer("time_taken").notNull(), // in seconds
  completedAt: timestamp("completed_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default("system"),
  registrationOpen: boolean("registration_open").default(true),
  quizActive: boolean("quiz_active").default(true),
  adminPassword: text("admin_password").notNull().default("admin123"),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  passcode: true,
  hasCompletedQuiz: true,
  registeredAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertQuizSubmissionSchema = createInsertSchema(quizSubmissions).omit({
  id: true,
  completedAt: true,
});

export const updateSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertQuizSubmission = z.infer<typeof insertQuizSubmissionSchema>;
export type UpdateSystemSettings = z.infer<typeof updateSystemSettingsSchema>;

export type Participant = typeof participants.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type SystemSettings = typeof systemSettings.$inferSelect;

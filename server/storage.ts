import { 
  participants,
  schools,
  questions,
  quizSubmissions,
  systemSettings,
  type Participant, 
  type School,
  type Question, 
  type QuizSubmission, 
  type SystemSettings,
  type InsertParticipant, 
  type InsertSchool,
  type InsertQuestion, 
  type InsertQuizSubmission,
  type UpdateSystemSettings
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

type MemberInfo = InsertParticipant & {
  subject: string;
  isLeader: boolean;
};

export interface IStorage {
  // Participants
  getParticipant(id: string): Promise<Participant | undefined>;
  getParticipantByPasscode(passcode: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant, mode: "solo" | "school", schoolId?: string, subject?: string, isLeader?: boolean): Promise<Participant>;
  updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined>;
  getAllParticipants(): Promise<Participant[]>;
  deleteParticipant(id: string): Promise<boolean>;

  // Schools
  getSchool(id: string): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  getAllSchools(): Promise<School[]>;
  deleteSchool(id: string): Promise<boolean>;
  registerSchoolWithMembers(schoolName: string, members: MemberInfo[]): Promise<{ school: School, newParticipants: Participant[] }>;

  // Questions
  getQuestion(id: string): Promise<Question | undefined>;
  getAllQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, updates: Partial<Question>): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<boolean>;
  
  // Quiz Submissions
  getQuizSubmission(id: string): Promise<QuizSubmission | undefined>;
  getAllQuizSubmissions(): Promise<QuizSubmission[]>;
  createQuizSubmission(submission: InsertQuizSubmission): Promise<QuizSubmission>;
  deleteQuizSubmission(id: string): Promise<boolean>;
  
  // System Settings
  getSystemSettings(): Promise<SystemSettings>;
  updateSystemSettings(settings: UpdateSystemSettings): Promise<SystemSettings>;
}

export class DatabaseStorage implements IStorage {

  private generatePasscode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Participants
  async getParticipant(id: string): Promise<Participant | undefined> {
    const result = await db.select().from(participants).where(eq(participants.id, id));
    return result[0];
  }

  async getParticipantByPasscode(passcode: string): Promise<Participant | undefined> {
    const result = await db.select().from(participants).where(eq(participants.passcode, passcode));
    return result[0];
  }

  async createParticipant(insertParticipant: InsertParticipant, mode: "solo" | "school", schoolId?: string, subject?: string, isLeader?: boolean): Promise<Participant> {
    let passcode: string;
    do {
      passcode = this.generatePasscode();
    } while (await this.getParticipantByPasscode(passcode));

    const [participant] = await db
      .insert(participants)
      .values({
        ...insertParticipant,
        passcode,
        mode,
        schoolId,
        subject,
        isLeader,
      })
      .returning();
    return participant;
  }

  async updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined> {
    const [participant] = await db.update(participants).set(updates).where(eq(participants.id, id)).returning();
    return participant;
  }

  async getAllParticipants(): Promise<Participant[]> {
    return db.select().from(participants).orderBy(participants.registeredAt);
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const result = await db.delete(participants).where(eq(participants.id, id));
    return result.rowCount > 0;
  }

  // Schools
  async getSchool(id: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.id, id));
    return result[0];
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const [newSchool] = await db.insert(schools).values(school).returning();
    return newSchool;
  }

  async getAllSchools(): Promise<School[]> {
    return db.select().from(schools).orderBy(schools.createdAt);
  }

  async deleteSchool(id: string): Promise<boolean> {
    const result = await db.delete(schools).where(eq(schools.id, id));
    return result.rowCount > 0;
  }

  async registerSchoolWithMembers(schoolName: string, members: MemberInfo[]): Promise<{ school: School, newParticipants: Participant[] }> {
    return db.transaction(async (tx) => {
      const [school] = await tx.insert(schools).values({ name: schoolName }).returning();

      const newParticipants = [];
      for (const member of members) {
        let passcode: string;
        do {
          passcode = this.generatePasscode();
        } while (await this.getParticipantByPasscode(passcode));

        const [p] = await tx.insert(participants).values({
          name: member.name,
          email: member.email,
          phone: member.phone,
          passcode,
          mode: 'school',
          schoolId: school.id,
          subject: member.subject,
          isLeader: member.isLeader,
        }).returning();
        newParticipants.push(p);
      }

      return { school, newParticipants };
    });
  }

  // Questions
  async getQuestion(id: string): Promise<Question | undefined> {
    const result = await db.select().from(questions).where(eq(questions.id, id));
    return result[0];
  }

  async getAllQuestions(): Promise<Question[]> {
    return db.select().from(questions).orderBy(questions.orderIndex);
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question | undefined> {
    const [updated] = await db.update(questions).set(updates).where(eq(questions.id, id)).returning();
    return updated;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await db.delete(questions).where(eq(questions.id, id));
    return result.rowCount > 0;
  }

  // Quiz Submissions
  async getQuizSubmission(id: string): Promise<QuizSubmission | undefined> {
    const result = await db.select().from(quizSubmissions).where(eq(quizSubmissions.id, id));
    return result[0];
  }

  async getAllQuizSubmissions(): Promise<QuizSubmission[]> {
    return db.select().from(quizSubmissions).orderBy(quizSubmissions.completedAt);
  }

  async createQuizSubmission(submission: InsertQuizSubmission): Promise<QuizSubmission> {
    const [newSubmission] = await db.insert(quizSubmissions).values(submission).returning();
    return newSubmission;
  }

  async deleteQuizSubmission(id: string): Promise<boolean> {
    const result = await db.delete(quizSubmissions).where(eq(quizSubmissions.id, id));
    return result.rowCount > 0;
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.id, "system"));
    if (result[0]) return result[0];

    const defaults: Partial<SystemSettings> = {
      id: "system",
      soloRegistrationOpen: true,
      schoolRegistrationOpen: true,
      quizActive: false,
    } as any;

    const inserted = await db
      .insert(systemSettings)
      .values(defaults as any)
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) return inserted[0] as SystemSettings;

    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system"));
    return row as SystemSettings;
  }

  async updateSystemSettings(settings: UpdateSystemSettings): Promise<SystemSettings> {
    await this.getSystemSettings();
    const [updated] = await db
      .update(systemSettings)
      .set(settings as any)
      .where(eq(systemSettings.id, "system"))
      .returning();
    return updated as SystemSettings;
  }
}

export const storage = new DatabaseStorage();

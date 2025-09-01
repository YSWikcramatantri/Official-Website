import { 
  participants,
  teams,
  questions,
  quizSubmissions,
  systemSettings,
  type Participant, 
  type Team,
  type Question, 
  type QuizSubmission, 
  type SystemSettings,
  type InsertParticipant, 
  type InsertTeam,
  type InsertQuestion, 
  type InsertQuizSubmission,
  type UpdateSystemSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Participants
  getParticipant(id: string): Promise<Participant | undefined>;
  getParticipantByPasscode(passcode: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant, mode: 'solo' | 'team', teamId?: string): Promise<Participant>;
  updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined>;
  getAllParticipants(): Promise<Participant[]>;
  deleteParticipant(id: string): Promise<boolean>;
  
  // Teams
  getTeam(id: string): Promise<Team | undefined>;
  getTeamByJoinCode(joinCode: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  getAllTeams(): Promise<Team[]>;
  deleteTeam(id: string): Promise<boolean>;

  // Questions
  getQuestion(id: string): Promise<Question | undefined>;
  getAllQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, updates: Partial<Question>): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<boolean>;
  
  // Quiz Submissions
  getQuizSubmission(id: string): Promise<QuizSubmission | undefined>;
  getQuizSubmissionByParticipant(participantId: string): Promise<QuizSubmission | undefined>;
  getAllQuizSubmissions(): Promise<QuizSubmission[]>;
  createQuizSubmission(submission: InsertQuizSubmission): Promise<QuizSubmission>;
  deleteQuizSubmission(id: string): Promise<boolean>;
  
  // System Settings
  getSystemSettings(): Promise<SystemSettings>;
  updateSystemSettings(settings: UpdateSystemSettings): Promise<SystemSettings>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private initialized = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    if (this.initialized) return;

    console.log('🚀 Database Storage initialized');
    
    try {
      // Check if settings exist, if not create them
      const existingSettings = await db.select().from(systemSettings).limit(1);
      if (existingSettings.length === 0) {
        await db.insert(systemSettings).values({
          id: "system",
          soloRegistrationOpen: true,
          teamRegistrationOpen: true,
          quizActive: true,
          adminPassword: "admin123"
        });
      }

      // Check if questions exist, if not create sample questions
      const qCountResult = await db.select({ count: sql<number>`count(*)` }).from(questions);
      const qCount = qCountResult[0]?.count ?? 0;
      if (qCount === 0) {
        console.log('📚 Setting up sample astronomy quiz data...');
        await this.initializeSampleQuestions();
      }
      
      const finalQCountResult = await db.select({ count: sql<number>`count(*)` }).from(questions);
      const finalQCount = finalQCountResult[0]?.count ?? 0;
      console.log(`✅ Database ready with ${finalQCount} questions`);
      console.log('📊 Settings: Registration and Quiz systems active');
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  private async initializeSampleQuestions() {
    const sampleQuestions = [
      {
        text: "Which planet in our solar system has the most extensive ring system?",
        options: { A: "Jupiter", B: "Saturn", C: "Uranus", D: "Neptune" },
        correctAnswer: "B", timeLimit: 60, marks: 5, orderIndex: 1
      },
      {
        text: "What is the closest star to Earth after the Sun?",
        options: { A: "Proxima Centauri", B: "Alpha Centauri A", C: "Sirius", D: "Betelgeuse" },
        correctAnswer: "A", timeLimit: 45, marks: 3, orderIndex: 2
      },
      {
        text: "What type of galaxy is the Milky Way?",
        options: { A: "Elliptical", B: "Spiral", C: "Irregular", D: "Lenticular" },
        correctAnswer: "B", timeLimit: 40, marks: 4, orderIndex: 3
      },
      {
        text: "Which moon of Jupiter is known for its volcanic activity?",
        options: { A: "Europa", B: "Ganymede", C: "Io", D: "Callisto" },
        correctAnswer: "C", timeLimit: 50, marks: 4, orderIndex: 4
      },
      {
        text: "What is the main component of the Sun?",
        options: { A: "Helium", B: "Hydrogen", C: "Carbon", D: "Oxygen" },
        correctAnswer: "B", timeLimit: 35, marks: 3, orderIndex: 5
      }
    ];

    await db.insert(questions).values(sampleQuestions);
  }

  private generatePasscode(length = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Participants
  async getParticipant(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id));
    return participant || undefined;
  }

  async getParticipantByPasscode(passcode: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.passcode, passcode));
    return participant || undefined;
  }

  async createParticipant(insertParticipant: InsertParticipant, mode: 'solo' | 'team', teamId?: string): Promise<Participant> {
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
        teamId,
      })
      .returning();
    
    console.log(`👤 New ${mode} participant registered: ${participant.name} (${participant.passcode})`);
    return participant;
  }

  async updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined> {
    const [participant] = await db
      .update(participants)
      .set(updates)
      .where(eq(participants.id, id))
      .returning();
    return participant || undefined;
  }

  async getAllParticipants(): Promise<Participant[]> {
    return await db.select().from(participants).orderBy(participants.registeredAt);
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const result = await db.delete(participants).where(eq(participants.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Teams
  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async getTeamByJoinCode(joinCode: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.joinCode, joinCode));
    return team || undefined;
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    let joinCode: string;
    do {
      joinCode = this.generatePasscode(8); // 8-char join code for teams
    } while (await this.getTeamByJoinCode(joinCode));

    const [team] = await db
      .insert(teams)
      .values({
        ...insertTeam,
        joinCode,
      })
      .returning();

    console.log(`🏆 New team created: ${team.name} (${team.joinCode})`);
    return team;
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(teams.createdAt);
  }

  async deleteTeam(id: string): Promise<boolean> {
    const result = await db.delete(teams).where(eq(teams.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Questions
  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
  }

  async getAllQuestions(): Promise<Question[]> {
    return await db.select().from(questions).orderBy(questions.orderIndex);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await db
      .insert(questions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question | undefined> {
    const [question] = await db
      .update(questions)
      .set(updates)
      .where(eq(questions.id, id))
      .returning();
    return question || undefined;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await db.delete(questions).where(eq(questions.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Quiz Submissions
  async getQuizSubmission(id: string): Promise<QuizSubmission | undefined> {
    const [submission] = await db.select().from(quizSubmissions).where(eq(quizSubmissions.id, id));
    return submission || undefined;
  }

  async getQuizSubmissionByParticipant(participantId: string): Promise<QuizSubmission | undefined> {
    const [submission] = await db.select().from(quizSubmissions).where(eq(quizSubmissions.participantId, participantId));
    return submission || undefined;
  }

  async getAllQuizSubmissions(): Promise<QuizSubmission[]> {
    return await db.select().from(quizSubmissions).orderBy(quizSubmissions.completedAt);
  }

  async createQuizSubmission(submissionData: InsertQuizSubmission): Promise<QuizSubmission> {
    const [submission] = await db
      .insert(quizSubmissions)
      .values(submissionData)
      .returning();
    
    console.log(`💾 Quiz submission stored: ID ${submission.id}, Score: ${submission.score}/${submission.totalMarks}`);
    return submission;
  }

  async deleteQuizSubmission(id: string): Promise<boolean> {
    const result = await db.delete(quizSubmissions).where(eq(quizSubmissions.id, id));
    return (result.rowCount || 0) > 0;
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system"));
    return settings || {
      id: "system",
      soloRegistrationOpen: true,
      teamRegistrationOpen: true,
      quizActive: true,
      adminPassword: "admin123"
    };
  }

  async updateSystemSettings(settingsUpdate: UpdateSystemSettings): Promise<SystemSettings> {
    const [settings] = await db
      .update(systemSettings)
      .set(settingsUpdate)
      .where(eq(systemSettings.id, "system"))
      .returning();
    return settings;
  }
}

export const storage = new DatabaseStorage();

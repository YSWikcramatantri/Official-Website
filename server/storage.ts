import { 
  type Participant, 
  type Question, 
  type QuizSubmission, 
  type SystemSettings,
  type InsertParticipant, 
  type InsertQuestion, 
  type InsertQuizSubmission,
  type UpdateSystemSettings
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Participants
  getParticipant(id: string): Promise<Participant | undefined>;
  getParticipantByPasscode(passcode: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined>;
  getAllParticipants(): Promise<Participant[]>;
  deleteParticipant(id: string): Promise<boolean>;
  
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

export class MemStorage implements IStorage {
  private participants: Map<string, Participant>;
  private questions: Map<string, Question>;
  private quizSubmissions: Map<string, QuizSubmission>;
  private systemSettings: SystemSettings;
  private initialized: boolean = false;

  constructor() {
    this.participants = new Map();
    this.questions = new Map();
    this.quizSubmissions = new Map();
    this.systemSettings = {
      id: "system",
      registrationOpen: true,
      quizActive: true,
      adminPassword: "admin123"
    };

    console.log('🚀 Memory Database initialized');
    this.initializeDatabase();
  }

  private initializeDatabase() {
    if (this.initialized) return;

    console.log('📚 Setting up sample astronomy quiz data...');
    
    // Initialize with comprehensive astronomy questions
    this.initializeSampleQuestions();
    
    // Log database stats
    console.log(`✅ Database ready with ${this.questions.size} questions`);
    console.log(`📊 Settings: Registration ${this.systemSettings.registrationOpen ? 'Open' : 'Closed'}, Quiz ${this.systemSettings.quizActive ? 'Active' : 'Inactive'}`);
    
    this.initialized = true;
  }

  private initializeSampleQuestions() {
    const sampleQuestions: Question[] = [
      {
        id: randomUUID(),
        text: "Which planet in our solar system has the most extensive ring system?",
        options: {
          A: "Jupiter",
          B: "Saturn",
          C: "Uranus", 
          D: "Neptune"
        },
        correctAnswer: "B",
        timeLimit: 60,
        marks: 5,
        orderIndex: 1
      },
      {
        id: randomUUID(),
        text: "What is the closest star to Earth after the Sun?",
        options: {
          A: "Proxima Centauri",
          B: "Alpha Centauri A",
          C: "Sirius",
          D: "Betelgeuse"
        },
        correctAnswer: "A",
        timeLimit: 45,
        marks: 3,
        orderIndex: 2
      },
      {
        id: randomUUID(),
        text: "What type of galaxy is the Milky Way?",
        options: {
          A: "Elliptical",
          B: "Spiral",
          C: "Irregular",
          D: "Lenticular"
        },
        correctAnswer: "B",
        timeLimit: 40,
        marks: 4,
        orderIndex: 3
      },
      {
        id: randomUUID(),
        text: "Which moon of Jupiter is known for its volcanic activity?",
        options: {
          A: "Europa",
          B: "Ganymede",
          C: "Io",
          D: "Callisto"
        },
        correctAnswer: "C",
        timeLimit: 50,
        marks: 4,
        orderIndex: 4
      },
      {
        id: randomUUID(),
        text: "What is the main component of the Sun?",
        options: {
          A: "Helium",
          B: "Hydrogen",
          C: "Carbon",
          D: "Oxygen"
        },
        correctAnswer: "B",
        timeLimit: 35,
        marks: 3,
        orderIndex: 5
      }
    ];

    sampleQuestions.forEach(question => {
      this.questions.set(question.id, question);
    });
  }

  // Enhanced memory database methods with logging
  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    let passcode: string;
    do {
      passcode = this.generatePasscode();
    } while (await this.getParticipantByPasscode(passcode));

    const participant: Participant = {
      ...insertParticipant,
      id: randomUUID(),
      passcode,
      hasCompletedQuiz: false,
      registeredAt: new Date()
    };
    
    this.participants.set(participant.id, participant);
    console.log(`👤 New participant registered: ${participant.name} (${participant.passcode})`);
    return participant;
  }

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
    return this.participants.get(id);
  }

  async getParticipantByPasscode(passcode: string): Promise<Participant | undefined> {
    return Array.from(this.participants.values()).find(p => p.passcode === passcode);
  }



  async updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined> {
    const participant = this.participants.get(id);
    if (!participant) return undefined;
    
    const updated = { ...participant, ...updates };
    this.participants.set(id, updated);
    return updated;
  }

  async getAllParticipants(): Promise<Participant[]> {
    return Array.from(this.participants.values())
      .sort((a, b) => new Date(b.registeredAt!).getTime() - new Date(a.registeredAt!).getTime());
  }

  async deleteParticipant(id: string): Promise<boolean> {
    return this.participants.delete(id);
  }

  // Questions
  async getQuestion(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async getAllQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const question: Question = {
      ...insertQuestion,
      id: randomUUID()
    };
    
    this.questions.set(question.id, question);
    return question;
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question | undefined> {
    const question = this.questions.get(id);
    if (!question) return undefined;
    
    const updated = { ...question, ...updates };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    return this.questions.delete(id);
  }

  // Quiz Submissions
  async getQuizSubmission(id: string): Promise<QuizSubmission | undefined> {
    return this.quizSubmissions.get(id);
  }

  async getQuizSubmissionByParticipant(participantId: string): Promise<QuizSubmission | undefined> {
    return Array.from(this.quizSubmissions.values()).find(s => s.participantId === participantId);
  }

  async getAllQuizSubmissions(): Promise<QuizSubmission[]> {
    return Array.from(this.quizSubmissions.values())
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }

  async createQuizSubmission(insertSubmission: InsertQuizSubmission): Promise<QuizSubmission> {
    const submission: QuizSubmission = {
      ...insertSubmission,
      id: randomUUID(),
      completedAt: new Date()
    };
    
    this.quizSubmissions.set(submission.id, submission);
    return submission;
  }

  async deleteQuizSubmission(id: string): Promise<boolean> {
    return this.quizSubmissions.delete(id);
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    return this.systemSettings;
  }

  async updateSystemSettings(settings: UpdateSystemSettings): Promise<SystemSettings> {
    this.systemSettings = { ...this.systemSettings, ...settings };
    return this.systemSettings;
  }
}

export const storage = new MemStorage();

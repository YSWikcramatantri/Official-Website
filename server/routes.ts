import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertParticipantSchema, 
  insertQuestionSchema, 
  insertQuizSubmissionSchema, 
  updateSystemSettingsSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Participant Registration
  app.post("/api/participants", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (!settings.registrationOpen) {
        return res.status(403).json({ message: "Registration is currently closed" });
      }

      const participantData = insertParticipantSchema.parse(req.body);
      const participant = await storage.createParticipant(participantData);
      
      res.json({ 
        id: participant.id, 
        passcode: participant.passcode,
        message: "Registration successful" 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  // Get participant by passcode (for quiz access)
  app.post("/api/participants/verify", async (req, res) => {
    try {
      const { passcode } = z.object({ passcode: z.string() }).parse(req.body);
      const participant = await storage.getParticipantByPasscode(passcode);
      
      if (!participant) {
        return res.status(404).json({ message: "Invalid passcode" });
      }

      if (participant.hasCompletedQuiz) {
        return res.status(403).json({ message: "Quiz already completed" });
      }

      const settings = await storage.getSystemSettings();
      if (!settings.quizActive) {
        return res.status(403).json({ message: "Quiz is currently inactive" });
      }

      res.json({ participant });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Get quiz questions (for authenticated participant)
  app.get("/api/questions", async (req, res) => {
    try {
      const questions = await storage.getAllQuestions();
      // Remove correct answers from response
      const questionsForQuiz = questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options,
        timeLimit: q.timeLimit,
        marks: q.marks,
        orderIndex: q.orderIndex
      }));
      
      res.json(questionsForQuiz);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Submit quiz answers
  app.post("/api/quiz-submissions", async (req, res) => {
    try {
      const submissionData = insertQuizSubmissionSchema.parse(req.body);
      
      // Check if participant exists and hasn't completed quiz
      const participant = await storage.getParticipant(submissionData.participantId);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      if (participant.hasCompletedQuiz) {
        return res.status(403).json({ message: "Quiz already completed" });
      }

      // Calculate score
      const questions = await storage.getAllQuestions();
      let score = 0;
      let totalMarks = 0;

      questions.forEach(question => {
        totalMarks += question.marks;
        if (submissionData.answers[question.id] === question.correctAnswer) {
          score += question.marks;
        }
      });

      const submission = await storage.createQuizSubmission({
        ...submissionData,
        score,
        totalMarks
      });

      // Mark participant as completed
      await storage.updateParticipant(participant.id, { hasCompletedQuiz: true });

      res.json({ 
        submissionId: submission.id, 
        score, 
        totalMarks,
        message: "Quiz submitted successfully" 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid submission data" });
    }
  });

  // Admin Authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = z.object({ password: z.string() }).parse(req.body);
      const settings = await storage.getSystemSettings();
      
      if (password !== settings.adminPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // Set session or return token (simplified for demo)
      req.session = req.session || {};
      (req.session as any).isAdmin = true;
      
      res.json({ message: "Login successful" });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Middleware to check admin authentication
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ message: "Admin access required" });
    }
    next();
  };

  // Admin - Get all participants
  app.get("/api/admin/participants", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getAllParticipants();
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  // Admin - Delete participant
  app.delete("/api/admin/participants/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteParticipant(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      res.json({ message: "Participant deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // Admin - Get all quiz submissions
  app.get("/api/admin/quiz-submissions", requireAdmin, async (req, res) => {
    try {
      const submissions = await storage.getAllQuizSubmissions();
      const participants = await storage.getAllParticipants();
      
      // Enrich submissions with participant data
      const enrichedSubmissions = submissions.map(submission => {
        const participant = participants.find(p => p.id === submission.participantId);
        return {
          ...submission,
          participantName: participant?.name || "Unknown",
          participantEmail: participant?.email || "Unknown"
        };
      });
      
      res.json(enrichedSubmissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Admin - Delete quiz submission
  app.delete("/api/admin/quiz-submissions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteQuizSubmission(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      res.json({ message: "Submission deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  // Admin - Get all questions (with correct answers)
  app.get("/api/admin/questions", requireAdmin, async (req, res) => {
    try {
      const questions = await storage.getAllQuestions();
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Admin - Create question
  app.post("/api/admin/questions", requireAdmin, async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data" });
    }
  });

  // Admin - Update question
  app.put("/api/admin/questions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertQuestionSchema.partial().parse(req.body);
      const question = await storage.updateQuestion(id, updates);
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data" });
    }
  });

  // Admin - Delete question
  app.delete("/api/admin/questions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteQuestion(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // Admin - Get system settings
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Admin - Update system settings
  app.put("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settingsData = updateSystemSettingsSchema.parse(req.body);
      const settings = await storage.updateSystemSettings(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Admin - Get dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getAllParticipants();
      const submissions = await storage.getAllQuizSubmissions();
      const questions = await storage.getAllQuestions();

      res.json({
        totalRegistrations: participants.length,
        totalSubmissions: submissions.length,
        totalQuestions: questions.length,
        completionRate: participants.length > 0 ? Math.round((submissions.length / participants.length) * 100) : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

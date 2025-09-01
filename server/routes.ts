import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertParticipantSchema, 
  insertTeamSchema,
  insertQuestionSchema, 
  insertQuizSubmissionSchema, 
  updateSystemSettingsSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // Public settings endpoint
  app.get("/api/settings", async (req, res) => {
    try {
      const { soloRegistrationOpen, teamRegistrationOpen, quizActive } = await storage.getSystemSettings();
      res.json({ soloRegistrationOpen, teamRegistrationOpen, quizActive });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  // Solo Participant Registration
  app.post("/api/participants", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (!settings.soloRegistrationOpen) {
        return res.status(403).json({ message: "Solo registration is currently closed" });
      }

      const participantData = insertParticipantSchema.parse(req.body);
      const participant = await storage.createParticipant(participantData, 'solo');
      
      res.json({ 
        id: participant.id, 
        passcode: participant.passcode,
        message: "Registration successful" 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  // Team Creation
  app.post("/api/teams", async (req, res) => {
    try {
      console.log("Received /api/teams request with body:", req.body);
      const settings = await storage.getSystemSettings();
      if (!settings.teamRegistrationOpen) {
        return res.status(403).json({ message: "Team registration is currently closed" });
      }

      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);

      res.json(team);
    } catch (error) {
      console.error("Error in /api/teams:", error);
      res.status(400).json({ message: "Invalid team data" });
    }
  });

  // Join Team
  app.post("/api/participants/join-team", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (!settings.teamRegistrationOpen) {
        return res.status(403).json({ message: "Team registration is currently closed" });
      }

      const { joinCode, ...participantData } = z.object({
        joinCode: z.string(),
        ...insertParticipantSchema.shape,
      }).parse(req.body);

      const team = await storage.getTeamByJoinCode(joinCode.toUpperCase());
      if (!team) {
        return res.status(404).json({ message: "Invalid join code" });
      }

      const participant = await storage.createParticipant(participantData, 'team', team.id);

      res.json({
        id: participant.id,
        passcode: participant.passcode,
        message: "Successfully joined team"
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid data for joining team" });
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
      const { participantId, answers, timeTaken } = insertQuizSubmissionSchema.extend({
        participantId: z.string(),
        timeTaken: z.number()
      }).parse(req.body);
      
      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      if (participant.hasCompletedQuiz) {
        return res.status(403).json({ message: "Quiz already completed" });
      }

      const questions = await storage.getAllQuestions();
      let score = 0;
      let totalMarks = 0;

      questions.forEach(question => {
        totalMarks += question.marks;
        if (answers[question.id] === question.correctAnswer) {
          score += question.marks;
        }
      });

      const submission = await storage.createQuizSubmission({
        participantId,
        answers,
        score,
        totalMarks,
        timeTaken
      });

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
  app.post("/api/admin/login", async (req: any, res) => {
    try {
      const { password } = z.object({ password: z.string() }).parse(req.body);
      const settings = await storage.getSystemSettings();
      
      if (password !== settings.adminPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }
      req.session.isAdmin = true;
      res.json({ message: "Login successful" });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Admin Logout
  app.post("/api/admin/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) return res.status(500).json({ message: "Could not log out" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Admin verification endpoint
  app.get("/api/admin/verify", (req: any, res) => {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ authenticated: true });
  });

  // Middleware to check admin authentication
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ message: "Admin access required" });
    }
    next();
  };

  app.use("/api/admin", requireAdmin);

  // Admin - Get all participants
  app.get("/api/admin/participants", async (req, res) => {
    try {
      const participants = await storage.getAllParticipants();
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  // Admin - Delete participant
  app.delete("/api/admin/participants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!await storage.deleteParticipant(id)) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json({ message: "Participant deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // Admin - Get all teams
  app.get("/api/admin/teams", async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      const participants = await storage.getAllParticipants();
      const teamsWithMembers = teams.map(team => ({
        ...team,
        members: participants.filter(p => p.teamId === team.id)
      }));
      res.json(teamsWithMembers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Admin - Delete team
  app.delete("/api/admin/teams/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!await storage.deleteTeam(id)) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete team" });
    }
  });


  // Admin - Get all quiz submissions
  app.get("/api/admin/quiz-submissions", async (req, res) => {
    try {
      const submissions = await storage.getAllQuizSubmissions();
      const participants = await storage.getAllParticipants();
      
      const enrichedSubmissions = submissions.map(submission => {
        const participant = participants.find(p => p.id === submission.participantId);
        return {
          ...submission,
          participantName: participant?.name || "Unknown",
          participantEmail: participant?.email || "Unknown",
          participantMode: participant?.mode,
          teamId: participant?.teamId
        };
      });
      
      res.json(enrichedSubmissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Admin - Delete quiz submission
  app.delete("/api/admin/quiz-submissions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!await storage.deleteQuizSubmission(id)) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.json({ message: "Submission deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  // Admin - Questions routes (no changes needed)
  app.get("/api/admin/questions", async (req, res) => {
    try {
      const questions = await storage.getAllQuestions();
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/admin/questions", async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data" });
    }
  });

  app.put("/api/admin/questions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertQuestionSchema.partial().parse(req.body);
      const question = await storage.updateQuestion(id, updates);
      if (!question) return res.status(404).json({ message: "Question not found" });
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data" });
    }
  });

  app.delete("/api/admin/questions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!await storage.deleteQuestion(id)) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // Admin - System settings
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/settings", async (req, res) => {
    try {
      const settingsData = updateSystemSettingsSchema.parse(req.body);
      const settings = await storage.updateSystemSettings(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Admin - Get dashboard stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const participants = await storage.getAllParticipants();
      const submissions = await storage.getAllQuizSubmissions();
      const questions = await storage.getAllQuestions();
      const teams = await storage.getAllTeams();

      const soloParticipants = participants.filter(p => p.mode === 'solo');
      const teamParticipants = participants.filter(p => p.mode === 'team');

      res.json({
        totalRegistrations: participants.length,
        totalSoloRegistrations: soloParticipants.length,
        totalTeamRegistrations: teamParticipants.length,
        totalTeams: teams.length,
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

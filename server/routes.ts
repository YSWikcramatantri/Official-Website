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

const SUBJECTS = ["Astrophysics", "Observational Astronomy", "Rocketry", "Cosmology", "General Astronomy"];

export async function registerRoutes(app: Express): Promise<Server> {

  // Public settings endpoint
  app.get("/api/settings", async (req, res) => {
    try {
      const { soloRegistrationOpen, schoolRegistrationOpen, quizActive } = await storage.getSystemSettings();
      res.json({ soloRegistrationOpen, schoolRegistrationOpen, quizActive });
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
      
      res.json({ newParticipants: [participant] });
    } catch (error) {
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  // School Registration
  app.post("/api/schools/register", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (!settings.schoolRegistrationOpen) {
        return res.status(403).json({ message: "School registration is currently closed" });
      }

      const schoolRegistrationSchema = z.object({
        schoolName: z.string().min(1, "School name is required"),
        members: z.array(insertParticipantSchema.extend({
          subject: z.enum(SUBJECTS as [string, ...string[]]),
          isLeader: z.boolean(),
        })).length(5, "A school team must have exactly 5 members."),
      });

      const { schoolName, members } = schoolRegistrationSchema.parse(req.body);

      // Validate leader
      if (members.filter(m => m.isLeader).length !== 1) {
        return res.status(400).json({ message: "Exactly one member must be designated as the leader." });
      }

      // Validate subjects
      const memberSubjects = members.map(m => m.subject);
      const uniqueSubjects = new Set(memberSubjects);
      if (uniqueSubjects.size !== 5) {
        return res.status(400).json({ message: "Each member must be assigned a unique subject from the required list." });
      }

      const result = await storage.registerSchoolWithMembers(schoolName, members);

      res.json({
        school: result.school,
        newParticipants: result.newParticipants.map(p => ({
          name: p.name,
          passcode: p.passcode,
          subject: p.subject
        }))
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid registration data", details: error.errors });
      }
      res.status(500).json({ message: "An unexpected error occurred." });
    }
  });


  // Get participant by passcode (for quiz access)
  app.post("/api/participants/verify", async (req, res) => {
    try {
      const { passcode } = z.object({ passcode: z.string() }).parse(req.body);
      const participant = await storage.getParticipantByPasscode(passcode);
      
      if (!participant) return res.status(404).json({ message: "Invalid passcode" });
      if (participant.hasCompletedQuiz) return res.status(403).json({ message: "Quiz already completed" });

      const settings = await storage.getSystemSettings();
      if (!settings.quizActive) return res.status(403).json({ message: "Quiz is currently inactive" });

      res.json({ participant });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Get quiz questions (for authenticated participant)
  app.get("/api/questions", async (req, res) => {
    // ... (no changes needed)
  });

  // Submit quiz answers
  app.post("/api/quiz-submissions", async (req, res) => {
    // ... (no changes needed)
  });

  // Admin routes
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.isAdmin) return res.status(401).json({ message: "Admin access required" });
    next();
  };

  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
      if (req.session) {
        req.session.isAdmin = true;
      }
      res.json({ message: "Login successful" });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  app.use("/api/admin", requireAdmin);

  app.get("/api/admin/schools", async (req, res) => {
    try {
      const schools = await storage.getAllSchools();
      const participants = await storage.getAllParticipants();
      const schoolsWithMembers = schools.map(s => ({
        ...s,
        members: participants.filter(p => p.schoolId === s.id)
      }));
      res.json(schoolsWithMembers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  // ... (other admin routes for participants, submissions, etc. would be updated similarly)

  const httpServer = createServer(app);
  return httpServer;
}

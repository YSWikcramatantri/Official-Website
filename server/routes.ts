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

  // Get quiz questions (public fetch; client controls access via passcode verification)
  app.get("/api/questions", async (_req, res) => {
    try {
      const qs = await storage.getAllQuestions();
      res.json(qs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Submit quiz answers
  app.post("/api/quiz-submissions", async (req, res) => {
    try {
      const parsed = insertQuizSubmissionSchema.parse(req.body);
      const submission = await storage.createQuizSubmission(parsed);
      // mark participant as completed
      await storage.updateParticipant(parsed.participantId, { hasCompletedQuiz: true });
      res.json(submission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid submission data", details: error.errors });
      }
      res.status(500).json({ message: "Failed to submit quiz" });
    }
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

  app.get("/api/admin/settings", async (_req, res) => {
    try {
      const s = await storage.getSystemSettings();
      res.json(s);
    } catch {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/settings", async (req, res) => {
    try {
      const body = z
        .object({
          soloRegistrationOpen: z.boolean().optional(),
          schoolRegistrationOpen: z.boolean().optional(),
          quizActive: z.boolean().optional(),
        })
        .parse(req.body);
      const updated = await storage.updateSystemSettings(body);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings payload", details: error.errors });
      }
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get("/api/admin/stats", async (_req, res) => {
    try {
      const [allParticipants, allSchools, allSubs] = await Promise.all([
        storage.getAllParticipants(),
        storage.getAllSchools(),
        storage.getAllQuizSubmissions(),
      ]);
      const totalSoloRegistrations = allParticipants.filter(p => p.mode === "solo").length;
      const totalSchoolMembers = allParticipants.filter(p => p.mode === "school").length;
      const totalSchools = allSchools.length;
      const totalSubmissions = allSubs.length;
      res.json({ totalSoloRegistrations, totalSchools, totalSchoolMembers, totalSubmissions });
    } catch {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/participants", async (_req, res) => {
    try {
      const ps = await storage.getAllParticipants();
      res.json(ps);
    } catch {
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  app.get("/api/admin/quiz-submissions", async (_req, res) => {
    try {
      const [subs, ps] = await Promise.all([
        storage.getAllQuizSubmissions(),
        storage.getAllParticipants(),
      ]);
      const enriched = subs.map(s => {
        const p = ps.find(pp => pp.id === s.participantId);
        return {
          id: s.id,
          participantId: s.participantId,
          participantName: p?.name ?? "Unknown",
          schoolId: p?.schoolId ?? null,
          score: s.score,
          timeTaken: s.timeTaken,
        };
      });
      res.json(enriched);
    } catch {
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.get("/api/admin/schools", async (_req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}

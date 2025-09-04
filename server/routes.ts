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
import crypto from "crypto";

const SUBJECTS = ["Astrophysics", "Observational Astronomy", "Rocketry", "Cosmology", "General Astronomy"];

const ADMIN_TOKEN_SECRET = process.env.SESSION_SECRET || "astronomy-quiz-secret-key";
function signAdminToken(payload: object, ttlMs = 24 * 60 * 60 * 1000) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifyAdminToken(token?: string) {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const body = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (typeof body.exp !== "number" || Date.now() > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

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

  // Solo Participant Registration (form-based)
  app.post("/api/participants", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (!settings.soloRegistrationOpen) {
        return res.status(403).json({ message: "Solo registration is currently closed" });
      }

      const participantData = z
        .object({
          name: z.string().min(1),
          email: z.string().optional(),
          phone: z.string().optional(),
          institution: z.string().optional(),
        })
        .parse(req.body);

      const participant = await storage.createParticipant(participantData as any, 'solo');
      res.json({ newParticipants: [participant] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid registration data", details: error.errors });
      }
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  // Solo: simple passcode generator (no form)
  app.post("/api/participants/solo-passcode", async (_req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (!settings.soloRegistrationOpen) {
        return res.status(403).json({ message: "Solo registration is currently closed" });
      }
      const name = `Solo ${Date.now()}`;
      const participant = await storage.createParticipant({ name } as any, 'solo');
      res.json({ passcode: participant.passcode, participant });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate passcode" });
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
        team: z.enum(["A", "B"]).default("A"),
        members: z
          .array(
            z.object({
              name: z.string().min(1),
              email: z.string().min(1),
              phone: z.string().min(1),
              subject: z.enum(SUBJECTS as [string, ...string[]]),
              isLeader: z.boolean(),
            }),
          )
          .length(5, "A school team must have exactly 5 members."),
      });

      const { schoolName, team, members } = schoolRegistrationSchema.parse(req.body);

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

      const result = await storage.registerSchoolWithMembers(schoolName, members, team);

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
      console.error("/api/schools/register failed:", error);
      const message = (error as any)?.message || "An unexpected error occurred.";
      res.status(500).json({ message });
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
    const auth = req.headers["authorization"]; // Bearer <token>
    const token = auth?.toString().startsWith("Bearer ") ? auth!.toString().slice(7) : undefined;
    const verified = verifyAdminToken(token);
    if (verified || req.session?.isAdmin) return next();
    return res.status(401).json({ message: "Admin access required" });
  };

  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
      if (!req.session) return res.status(500).json({ message: "Session not available" });
      req.session.regenerate((err: any) => {
        if (err) return res.status(500).json({ message: "Failed to start session" });
        req.session.isAdmin = true;
        req.session.save((saveErr: any) => {
          if (saveErr) return res.status(500).json({ message: "Failed to save session" });
          const token = signAdminToken({ role: "admin" });
          res.json({ message: "Login successful", token });
        });
      });
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

  // Delete a participant (admin)
  app.delete("/api/admin/participants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteParticipant(id);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "Participant not found" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // Delete a school (admin)
  app.delete("/api/admin/schools/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSchool(id);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "School not found" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

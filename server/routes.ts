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
import util from "util";

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
  app.get("/api/questions", async (req, res) => {
    try {
      const passcode = (req.query?.passcode as string) || null;
      if (!passcode) return res.status(403).json({ message: "Passcode required" });
      const participant = await storage.getParticipantByPasscode(passcode);
      if (!participant) return res.status(404).json({ message: "Invalid passcode" });
      if (participant.hasCompletedQuiz) return res.status(403).json({ message: "Quiz already completed for this participant" });

      // Use participant's registered mode/subject to filter questions
      const mode = participant.mode;
      const subject = participant.subject || null;

      let qs = await storage.getAllQuestions();
      if (mode === 'solo') {
        // Only questions explicitly marked for solo and without a subject should be used for solo participants
        qs = qs.filter(q => (q as any).mode === 'solo' && !(q as any).subject);
      } else if (mode === 'school' || mode === 'team') {
        // support 'school' legacy value
        qs = qs.filter(q => (q as any).mode === 'team' || (q as any).mode === 'both');
      }
      if (subject) {
        qs = qs.filter(q => (q as any).subject === subject);
      }

      // Debug logging to help trace unexpected question exposure
      try {
        console.log(`/api/questions: passcode=${passcode} participantMode=${participant.mode} subject=${participant.subject} matched=${qs.map(q => q.id).join(',')}`);
      } catch (e) {
        console.log('/api/questions debug log failed', e);
      }

      res.json(qs);
    } catch (error) {
      console.error('/api/questions failed:', error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Submit quiz answers
  app.post("/api/quiz-submissions", async (req, res) => {
    try {
      console.log('/api/quiz-submissions body (full):', util.inspect(req.body, { depth: 4, maxArrayLength: 50 }));
      // Expect minimal submission data from client
      const schemaPayload = z.object({
        participantId: z.string().min(1),
        answers: z.record(z.string()),
        timeTaken: z.number().int().nonnegative()
      });
      const parsed = schemaPayload.safeParse(req.body);
      if (!parsed.success) {
        console.error('/api/quiz-submissions validation failed:', parsed.error.format());
        return res.status(400).json({ message: 'Invalid submission data', details: parsed.error.format() });
      }
      const payload = parsed.data;

      const participant = await storage.getParticipant(payload.participantId);
      if (!participant) return res.status(404).json({ message: 'Participant not found' });
      if (participant.hasCompletedQuiz) return res.status(403).json({ message: 'Participant already completed quiz' });

      // Fetch applicable questions for this participant
      let qs = await storage.getAllQuestions();
      if (participant.mode === 'solo') {
        qs = qs.filter(q => (q as any).mode === 'solo' && !(q as any).subject);
      } else {
        qs = qs.filter(q => (q as any).mode === 'team' || (q as any).mode === 'both');
        if (participant.subject) qs = qs.filter(q => (q as any).subject === participant.subject);
      }

      // Compute score and total marks
      let score = 0;
      let totalMarks = 0;
      for (const q of qs) {
        totalMarks += (q as any).marks || 0;
        const userAns = payload.answers[(q as any).id];
        if (userAns && userAns === (q as any).correctAnswer) {
          score += (q as any).marks || 0;
        }
      }

      const toSave = {
        participantId: payload.participantId,
        answers: payload.answers,
        score,
        totalMarks,
        timeTaken: payload.timeTaken
      } as any;

      const created = await storage.createQuizSubmission(toSave);
      await storage.updateParticipant(payload.participantId, { hasCompletedQuiz: true });

      res.json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid submission payload', details: error.errors });
      console.error('/api/quiz-submissions failed', error);
      res.status(500).json({ message: 'Failed to submit quiz' });
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

  // Admin: Questions CRUD
  app.get('/api/admin/questions', async (req, res) => {
    try {
      console.log('/api/admin/questions GET headers:', { auth: req.headers['authorization'] });
      const qs = await storage.getAllQuestions();
      res.json(qs);
    } catch (err) {
      console.error('/api/admin/questions GET failed:', err);
      res.status(500).json({ message: 'Failed to fetch questions' });
    }
  });

  app.post('/api/admin/questions', async (req, res) => {
    try {
      console.log('/api/admin/questions POST headers:', { auth: req.headers['authorization'] });
      console.log('/api/admin/questions POST body preview:', JSON.stringify(req.body).slice(0, 500));
      let parsed = insertQuestionSchema.parse(req.body) as any;
      // Ensure solo questions don't carry a subject
      if (parsed.mode === 'solo') parsed.subject = null;
      const q = await storage.createQuestion(parsed as any);
      res.json(q);
    } catch (err) {
      console.error('/api/admin/questions POST failed:', err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: 'Invalid question payload', details: err.errors });
      const message = (err as any)?.message || 'Failed to create question';
      // Expose stack when not in production for easier debugging
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ message, stack: (err as any)?.stack });
      }
      res.status(500).json({ message });
    }
  });

  app.put('/api/admin/questions/:id', async (req, res) => {
    try {
      const id = req.params.id;
      let parsed = insertQuestionSchema.parse(req.body) as any;
      if (parsed.mode === 'solo') parsed.subject = null;
      const updated = await storage.updateQuestion(id, parsed as any);
      if (!updated) return res.status(404).json({ message: 'Question not found' });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: 'Invalid question payload', details: err.errors });
      res.status(500).json({ message: (err as any)?.message || 'Failed to update question' });
    }
  });

  app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteQuestion(id);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: 'Question not found' });
    } catch (err) {
      res.status(500).json({ message: 'Failed to delete question' });
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
          participantMode: p?.mode ?? 'solo',
          score: s.score,
          timeTaken: s.timeTaken,
        };
      });
      res.json(enriched);
    } catch (e) {
      console.error('/api/admin/quiz-submissions GET failed', e);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Get a single submission with answers and participant info
  app.get('/api/admin/quiz-submissions/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const submission = await storage.getQuizSubmission(id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });
      const participant = await storage.getParticipant(submission.participantId as string);
      res.json({ submission, participant });
    } catch (e) {
      console.error('/api/admin/quiz-submissions/:id failed', e);
      res.status(500).json({ message: 'Failed to fetch submission' });
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
      const id = req.params?.id || req.body?.id || req.query?.id;
      console.log("DELETE participant request for id:", id);
      if (!id) return res.status(400).json({ message: "Missing participant id" });
      const deleted = await storage.deleteParticipant(id);
      console.log("DELETE participant result:", deleted);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "Participant not found" });
    } catch (error) {
      console.error("Failed to delete participant:", error);
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // Delete a participant (admin) alternate route accepting query/body
  app.delete("/api/admin/participants", async (req, res) => {
    try {
      const id = req.body?.id || req.query?.id;
      console.log("DELETE participant (alt) request for id:", id);
      if (!id) return res.status(400).json({ message: "Missing participant id" });
      const deleted = await storage.deleteParticipant(id);
      console.log("DELETE participant (alt) result:", deleted);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "Participant not found" });
    } catch (error) {
      console.error("Failed to delete participant (alt):", error);
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // Delete a school (admin)
  app.delete("/api/admin/schools/:id", async (req, res) => {
    try {
      const id = req.params?.id || req.body?.id || req.query?.id;
      console.log("DELETE school request for id:", id);
      if (!id) return res.status(400).json({ message: "Missing school id" });
      const deleted = await storage.deleteSchool(id);
      console.log("DELETE school result:", deleted);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "School not found" });
    } catch (error) {
      console.error("Failed to delete school:", error);
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  // Delete a school (admin) alternate route accepting query/body
  app.delete("/api/admin/schools", async (req, res) => {
    try {
      const id = req.body?.id || req.query?.id;
      console.log("DELETE school (alt) request for id:", id);
      if (!id) return res.status(400).json({ message: "Missing school id" });
      const deleted = await storage.deleteSchool(id);
      console.log("DELETE school (alt) result:", deleted);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "School not found" });
    } catch (error) {
      console.error("Failed to delete school (alt):", error);
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  // Fallback POST endpoints for environments that block DELETE requests (e.g., adblockers)
  app.post("/api/admin/participants/delete", async (req, res) => {
    try {
      const id = req.body?.id || req.query?.id;
      console.log("POST delete participant request for id:", id);
      if (!id) return res.status(400).json({ message: "Missing participant id" });
      const deleted = await storage.deleteParticipant(id);
      console.log("POST delete participant result:", deleted);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "Participant not found" });
    } catch (error) {
      console.error("Failed to delete participant via POST:", error);
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  app.post("/api/admin/schools/delete", async (req, res) => {
    try {
      const id = req.body?.id || req.query?.id;
      console.log("POST delete school request for id:", id);
      if (!id) return res.status(400).json({ message: "Missing school id" });
      const deleted = await storage.deleteSchool(id);
      console.log("POST delete school result:", deleted);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: "School not found" });
    } catch (error) {
      console.error("Failed to delete school via POST:", error);
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  // Delete a quiz submission (admin)
  app.delete('/api/admin/quiz-submissions/:id', async (req, res) => {
    try {
      const id = req.params?.id || req.body?.id || req.query?.id;
      console.log('DELETE quiz submission request for id:', id);
      if (!id) return res.status(400).json({ message: 'Missing submission id' });

      const submission = await storage.getQuizSubmission(id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      // Reset participant's completed flag if participant exists
      if (submission.participantId) {
        try {
          await storage.updateParticipant(submission.participantId as string, { hasCompletedQuiz: false });
        } catch (e) {
          console.error('Failed to reset participant hasCompletedQuiz flag:', e);
        }
      }

      const deleted = await storage.deleteQuizSubmission(id);
      if (deleted) return res.json({ success: true });
      return res.status(500).json({ message: 'Failed to delete submission' });
    } catch (error) {
      console.error('Failed to delete submission:', error);
      res.status(500).json({ message: 'Failed to delete submission' });
    }
  });

  app.delete('/api/admin/quiz-submissions', async (req, res) => {
    try {
      const id = req.body?.id || req.query?.id;
      console.log('DELETE quiz submission (alt) request for id:', id);
      if (!id) return res.status(400).json({ message: 'Missing submission id' });

      const submission = await storage.getQuizSubmission(id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      if (submission.participantId) {
        try {
          await storage.updateParticipant(submission.participantId as string, { hasCompletedQuiz: false });
        } catch (e) {
          console.error('Failed to reset participant hasCompletedQuiz flag (alt):', e);
        }
      }

      const deleted = await storage.deleteQuizSubmission(id);
      if (deleted) return res.json({ success: true });
      return res.status(500).json({ message: 'Failed to delete submission' });
    } catch (error) {
      console.error('Failed to delete submission (alt):', error);
      res.status(500).json({ message: 'Failed to delete submission (alt)' });
    }
  });

  app.post('/api/admin/quiz-submissions/delete', async (req, res) => {
    try {
      const id = req.body?.id || req.query?.id;
      console.log('POST delete submission request for id:', id);
      if (!id) return res.status(400).json({ message: 'Missing submission id' });
      const deleted = await storage.deleteQuizSubmission(id);
      if (deleted) return res.json({ success: true });
      return res.status(404).json({ message: 'Submission not found' });
    } catch (error) {
      console.error('Failed to delete submission via POST:', error);
      res.status(500).json({ message: 'Failed to delete submission' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

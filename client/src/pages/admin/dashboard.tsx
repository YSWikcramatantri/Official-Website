import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, LogOut, Users, User, Trophy, Trash2, Home, Star } from "lucide-react";
import QuestionFormModal from "@/components/question-form-modal";
import SubmissionDetailsModal from "@/components/submission-details-modal";
import type { Participant, School, SystemSettings, Question } from "@shared/schema";

interface SchoolWithMembers extends School {
  members: Participant[];
}

interface EnrichedSubmission {
  id: string;
  participantId: string;
  participantName: string;
  schoolId?: string | null;
  score: number;
  timeTaken: number;
}

interface DashboardStats {
  totalSoloRegistrations: number;
  totalSchools: number;
  totalSchoolMembers: number;
  totalSubmissions: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const statsQuery = useQuery<DashboardStats>({ queryKey: ["/api/admin/stats"], queryFn: getQueryFn({ on401: "returnNull" }) });
  const settingsQuery = useQuery<SystemSettings | null>({ queryKey: ["/api/admin/settings"], queryFn: getQueryFn({ on401: "returnNull" }), refetchOnMount: true });
  const participantsQuery = useQuery<Participant[] | null>({ queryKey: ["/api/admin/participants"], queryFn: getQueryFn({ on401: "returnNull" }) });
  const schoolsQuery = useQuery<SchoolWithMembers[] | null>({ queryKey: ["/api/admin/schools"], queryFn: getQueryFn({ on401: "returnNull" }) });
  const submissionsQuery = useQuery<EnrichedSubmission[] | null>({ queryKey: ["/api/admin/quiz-submissions"], queryFn: getQueryFn({ on401: "returnNull" }) });

  const stats = statsQuery.data ?? undefined;
  const settings = settingsQuery.data ?? null;
  const participants = participantsQuery.data ?? [];
  const schools = (schoolsQuery.data ?? []).map(s => ({ ...s, members: s.members ?? [] }));
  const submissions = submissionsQuery.data ?? [];

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionModalInitialData, setQuestionModalInitialData] = useState<any>(null);

  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [selectedSubmissionDetails, setSelectedSubmissionDetails] = useState<any | null>(null);

  const openSubmissionDetails = async (id: string) => {
    try {
      const res = await apiRequest('GET', `/api/admin/quiz-submissions/${id}`);
      const data = await res.json();
      setSelectedSubmissionDetails(data);
      setIsSubmissionModalOpen(true);
    } catch (e: any) {
      toast({ title: 'Failed to load submission', description: (e as any)?.message, variant: 'destructive' });
    }
  };

  const questionsQuery = useQuery<Question[] | null>({ queryKey: ["/api/admin/questions"], queryFn: getQueryFn({ on401: "returnNull" }) });
  const questions = questionsQuery.data ?? [];

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => apiRequest("PUT", "/api/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Settings Updated" });
    },
  });

  const schoolLeaderboard = useMemo(() => {
    const schoolScores: Record<string, { score: number; time: number; members: number }> = {};
    (submissions ?? []).forEach(s => {
      if (s.schoolId) {
        if (!schoolScores[s.schoolId]) schoolScores[s.schoolId] = { score: 0, time: 0, members: 0 };
        schoolScores[s.schoolId].score += s.score;
        schoolScores[s.schoolId].time += s.timeTaken;
        schoolScores[s.schoolId].members++;
      }
    });
    return Object.entries(schoolScores)
      .map(([schoolId, data]) => ({ schoolId, ...data, school: schools.find(s => s.id === schoolId) }))
      .filter(s => s.school && s.members === 5)
      .sort((a, b) => b.score - a.score || a.time - b.time);
  }, [submissions, schools]);

  if (settingsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading…</div>
    );
  }

  if (settings === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Admin login required</CardTitle></CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/admin/x9k2p8m7q1")}>Go to Admin Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // helper to delete resources
  const handleDeleteResource = async (url: string, successTitle: string) => {
    try {
      console.log('Attempting delete', url, 'adminTokenPresent=', !!localStorage.getItem('adminToken'));
      const res = await apiRequest('DELETE', url);
      console.log('Delete response', res.status, await (async () => { try { return await res.clone().text(); } catch { return ''; } })());
      try { await res.json(); } catch {}
      toast({ title: successTitle });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schools'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/participants'] });
      return;
    } catch (e) {
      console.warn('DELETE failed; attempting POST fallback', e);
    }

    // fallback: some clients/filters block DELETE; try POST to /delete endpoint
    try {
      // extract resource and id
      const match = url.match(/\/api\/admin\/(participants|schools)\/(.+)$/);
      if (!match) throw new Error('Unsupported delete URL');
      const resource = match[1];
      const id = match[2];
      const postUrl = `/api/admin/${resource}/delete`;
      const res2 = await apiRequest('POST', postUrl, { id });
      console.log('POST delete response', res2.status, await (async () => { try { return await res2.clone().text(); } catch { return ''; } })());
      try { await res2.json(); } catch {}
      toast({ title: successTitle });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schools'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/participants'] });
      return;
    } catch (e) {
      const errMsg = (e as Error)?.message ?? 'Delete failed';
      console.error('Fallback delete failed', url, e);
      toast({ title: 'Delete failed', description: errMsg, variant: 'destructive' });
    }
  };

  const handleCopy = async (text: string, label = 'Copied') => {
    // Try Clipboard API first
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast({ title: label });
        return;
      }
    } catch (err) {
      console.debug('Clipboard API failed or blocked:', err);
    }

    // Fallback: trigger a file download so user can open and copy manually
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded', description: 'File downloaded — open it to copy the content' });
      return;
    } catch (err) {
      console.debug('Download fallback failed:', err);
    }

    // Last resort: instruct user
    toast({ title: 'Copy failed', description: 'Clipboard access blocked by the browser or iframe. Open this page in a new tab to copy.', variant: 'destructive' });
  };

  const copyAllPhones = async (members: (Participant | any)[]) => {
    const phones = members.map(m => m.phone).filter(Boolean).join('\n');
    if (!phones) {
      toast({ title: 'No phone numbers available' });
      return;
    }
    await handleCopy(phones, 'Copied phone numbers');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="bg-[hsl(var(--card))] shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-5 flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center text-[hsl(var(--foreground))]"><Settings className="mr-3" />Admin Dashboard</h1>
          <Button onClick={() => setLocation("/")} variant="secondary" size="lg"><Home className="mr-2" />Go Home</Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs defaultValue="summary">
          <TabsList className="bg-[hsl(var(--muted))] rounded-xl p-1">
            <TabsTrigger value="summary" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Summary</TabsTrigger>
            <TabsTrigger value="registrations" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Registrations</TabsTrigger>
            <TabsTrigger value="questions" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Questions</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="grid lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid md:grid-cols-4 gap-6">
                <Card><CardHeader><CardTitle>Solo Registrations</CardTitle></CardHeader><CardContent><p className="text-4xl font-extrabold text-[hsl(var(--primary))]">{stats?.totalSoloRegistrations ?? 0}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Schools Registered</CardTitle></CardHeader><CardContent><p className="text-4xl font-extrabold text-[hsl(var(--primary))]">{stats?.totalSchools ?? 0}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>School Members</CardTitle></CardHeader><CardContent><p className="text-4xl font-extrabold text-[hsl(var(--primary))]">{stats?.totalSchoolMembers ?? 0}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Total Submissions</CardTitle></CardHeader><CardContent><p className="text-4xl font-extrabold text-[hsl(var(--primary))]">{stats?.totalSubmissions ?? 0}</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="flex items-center"><Trophy className="mr-2 text-yellow-500" />School Leaderboard</CardTitle></CardHeader>
                <CardContent>
                  {schoolLeaderboard.map((s, i) => (
                    <div key={s.schoolId} className="flex justify-between p-2"><span>{i + 1}. {s.school?.name}</span><span>{s.score} pts</span></div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div>
              <Card>
                <CardHeader><CardTitle>Quiz Controls</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-lg"><p>Solo Registration</p><Button size="lg" className="text-black font-bold" onClick={() => updateSettingsMutation.mutate({ soloRegistrationOpen: !settings?.soloRegistrationOpen })}>{settings?.soloRegistrationOpen ? "Open" : "Closed"}</Button></div>
                  <div className="flex justify-between items-center text-lg"><p>School Registration</p><Button size="lg" className="text-black font-bold" onClick={() => updateSettingsMutation.mutate({ schoolRegistrationOpen: !settings?.schoolRegistrationOpen })}>{settings?.schoolRegistrationOpen ? "Open" : "Closed"}</Button></div>
                  <div className="flex justify-between items-center text-lg"><p>Quiz Activity</p><Button size="lg" className="text-black font-bold" onClick={() => updateSettingsMutation.mutate({ quizActive: !settings?.quizActive })}>{settings?.quizActive ? "Active" : "Inactive"}</Button></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="registrations" className="mt-4">
            <Tabs defaultValue="schools">
              <TabsList className="bg-[hsl(var(--muted))] rounded-xl p-1">
                <TabsTrigger value="schools" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Schools</TabsTrigger>
                <TabsTrigger value="solo" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Solo Participants</TabsTrigger>
              </TabsList>
              <TabsContent value="schools">
                <Table>
                  <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Team</TableHead><TableHead>Members</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {schools.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="align-top">{s.name}</TableCell>
                        <TableCell className="align-top">{s.team ?? 'A'}</TableCell>
                        <TableCell>
                          <div>
                            {(s.members ?? []).map(m => (
                              <div key={m.id} className="mb-2">
                                <div className="font-medium">{m.name} {m.isLeader && <Star className="inline w-4 h-4 text-yellow-500" />}</div>
                                <div className="text-sm text-muted-foreground">{m.subject} • {m.email ?? "—"} • {m.phone ?? "—"} • <span className="font-mono">{m.passcode}</span></div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Button variant="destructive" size="sm" onClick={async () => { if (!confirm('Delete this school? This will remove the school record.')) return; await handleDeleteResource(`/api/admin/schools/${s.id}`, 'School deleted'); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" onClick={() => copyAllPhones(s.members)}>Copy phones</Button>
                            <Button size="sm" onClick={() => handleCopy((s.members ?? []).map((m:any)=>m.passcode).filter(Boolean).join('\n'), 'Copied passcodes')}>Copy passcodes</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="solo">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Subject</TableHead><TableHead>Contact</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(participants ?? []).filter(p => p.mode === 'solo').map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.subject ?? 'Solo'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.email ?? '—'} • {p.phone ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <div className="font-mono text-sm">{p.passcode}</div>
                            <Button size="sm" onClick={() => handleCopy(p.passcode ?? '', 'Copied passcode')}>Copy</Button>
                            <Button variant="destructive" size="sm" onClick={async () => { if (!confirm('Delete this participant?')) return; await handleDeleteResource(`/api/admin/participants/${p.id}`, 'Participant deleted'); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="questions">
            {questionsQuery.data === null ? (
              <Card>
                <CardHeader><CardTitle>Admin access required</CardTitle></CardHeader>
                <CardContent>
                  <p className="mb-4">You must be logged in as an admin to view and manage questions.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => setLocation('/admin/x9k2p8m7q1')}>Go to Admin Login</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Questions</h3>
                </div>

                <div className="mt-4">
                  {/* Sub-tabs: Solo and Team */}
                  <Tabs defaultValue="solo">
                    <TabsList className="bg-[hsl(var(--muted))] rounded-xl p-1">
                      <TabsTrigger value="solo" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Solo</TabsTrigger>
                      <TabsTrigger value="team" className="rounded-lg px-4 py-2 data-[state=active]:bg-[hsl(var(--card))]">Team</TabsTrigger>
                    </TabsList>

                    <TabsContent value="solo" className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-muted-foreground">Showing questions for Solo (mode = solo)</div>
                        <Button size="sm" onClick={() => { setEditingQuestion(null); setQuestionModalInitialData({ mode: 'solo', subject: '' }); setIsQuestionModalOpen(true); }}>Add Solo Question</Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Text</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Time (s)</TableHead>
                            <TableHead>Marks</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {questions.filter(q => ((q as any).mode === 'solo')).map(q => (
                            <TableRow key={q.id}>
                              <TableCell>{q.orderIndex}</TableCell>
                              <TableCell className="max-w-xl truncate">{q.text}</TableCell>
                              <TableCell>{(q as any).mode ?? 'both'}</TableCell>
                              <TableCell>{q.timeLimit}</TableCell>
                              <TableCell>{q.marks}</TableCell>
                              <TableCell>
                                <div className="flex gap-2 items-center">
                                  <Button size="sm" onClick={() => { setEditingQuestion(q); setQuestionModalInitialData(null); setIsQuestionModalOpen(true); }}>Edit</Button>
                                  <Button variant="destructive" size="sm" onClick={async () => {
                                    if (!confirm('Delete this question?')) return;
                                    try {
                                      await apiRequest('DELETE', `/api/admin/questions/${q.id}`);
                                      queryClient.invalidateQueries({ queryKey: ['/api/admin/questions'] });
                                      toast({ title: 'Question deleted' });
                                    } catch (e: any) {
                                      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
                                    }
                                  }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="team" className="mt-4">
                      {/* Team subjects nested tabs */}
                      <Tabs defaultValue="Astrophysics">
                        <TabsList className="bg-[hsl(var(--muted))] rounded-xl p-1">
                          { ["Astrophysics", "Observational Astronomy", "Rocketry", "Cosmology", "General Astronomy"].map(s => (
                            <TabsTrigger key={s} value={s} className="rounded-lg px-3 py-2 text-sm data-[state=active]:bg-[hsl(var(--card))]">{s}</TabsTrigger>
                          )) }
                        </TabsList>

                        { ["Astrophysics", "Observational Astronomy", "Rocketry", "Cosmology", "General Astronomy"].map(s => (
                          <TabsContent key={s} value={s} className="mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm text-muted-foreground">Showing questions for subject: {s}</div>
                              <Button size="sm" onClick={() => { setEditingQuestion(null); setQuestionModalInitialData({ mode: 'team', subject: s }); setIsQuestionModalOpen(true); }}>Add Question for {s}</Button>
                            </div>

                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Order</TableHead>
                                  <TableHead>Text</TableHead>
                                  <TableHead>Mode</TableHead>
                                  <TableHead>Time (s)</TableHead>
                                  <TableHead>Marks</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {questions.filter(q => (((q as any).mode === 'team' || (q as any).mode === 'both') && (q as any).subject === s)).map(q => (
                                  <TableRow key={q.id}>
                                    <TableCell>{q.orderIndex}</TableCell>
                                    <TableCell className="max-w-xl truncate">{q.text}</TableCell>
                                    <TableCell>{(q as any).mode ?? 'both'}</TableCell>
                                    <TableCell>{q.timeLimit}</TableCell>
                                    <TableCell>{q.marks}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-2 items-center">
                                        <Button size="sm" onClick={() => { setEditingQuestion(q); setQuestionModalInitialData(null); setIsQuestionModalOpen(true); }}>Edit</Button>
                                        <Button variant="destructive" size="sm" onClick={async () => {
                                          if (!confirm('Delete this question?')) return;
                                          try {
                                            await apiRequest('DELETE', `/api/admin/questions/${q.id}`);
                                            queryClient.invalidateQueries({ queryKey: ['/api/admin/questions'] });
                                            toast({ title: 'Question deleted' });
                                          } catch (e: any) {
                                            toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
                                          }
                                        }}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </TabsContent>

                  </Tabs>
                </div>

                <QuestionFormModal isOpen={isQuestionModalOpen} onClose={() => { setIsQuestionModalOpen(false); setEditingQuestion(null); setQuestionModalInitialData(null); }} question={editingQuestion} initialData={questionModalInitialData} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

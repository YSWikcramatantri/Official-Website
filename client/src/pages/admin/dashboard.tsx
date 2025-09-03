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
import type { Participant, School, SystemSettings } from "@shared/schema";

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

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center"><Settings className="mr-2" />Admin Dashboard</h1>
          <Button onClick={() => setLocation("/")} variant="ghost"><Home className="mr-2" />Go Home</Button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="grid lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                <Card><CardHeader><CardTitle>Solo Registrations</CardTitle></CardHeader><CardContent><p className="text-2xl">{stats?.totalSoloRegistrations ?? 0}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Schools Registered</CardTitle></CardHeader><CardContent><p className="text-2xl">{stats?.totalSchools ?? 0}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>School Members</CardTitle></CardHeader><CardContent><p className="text-2xl">{stats?.totalSchoolMembers ?? 0}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Total Submissions</CardTitle></CardHeader><CardContent><p className="text-2xl">{stats?.totalSubmissions ?? 0}</p></CardContent></Card>
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
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center"><p>Solo Registration</p><Button size="sm" onClick={() => updateSettingsMutation.mutate({ soloRegistrationOpen: !settings?.soloRegistrationOpen })}>{settings?.soloRegistrationOpen ? "Open" : "Closed"}</Button></div>
                  <div className="flex justify-between items-center"><p>School Registration</p><Button size="sm" onClick={() => updateSettingsMutation.mutate({ schoolRegistrationOpen: !settings?.schoolRegistrationOpen })}>{settings?.schoolRegistrationOpen ? "Open" : "Closed"}</Button></div>
                  <div className="flex justify-between items-center"><p>Quiz Activity</p><Button size="sm" onClick={() => updateSettingsMutation.mutate({ quizActive: !settings?.quizActive })}>{settings?.quizActive ? "Active" : "Inactive"}</Button></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="registrations" className="mt-4">
            <Tabs defaultValue="schools">
              <TabsList>
                <TabsTrigger value="schools">Schools</TabsTrigger>
                <TabsTrigger value="solo">Solo Participants</TabsTrigger>
              </TabsList>
              <TabsContent value="schools">
                <Table>
                  <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Members</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {schools.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>
                          {(s.members ?? []).map(m => <div key={m.id}>{m.name} ({m.subject}) {m.isLeader && <Star className="inline w-4 h-4 text-yellow-500" />}</div>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="solo">
                {/* Solo participants table */}
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="questions">
            {/* Questions management */}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

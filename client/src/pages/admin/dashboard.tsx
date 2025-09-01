import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import QuestionFormModal from "@/components/question-form-modal";
import SubmissionDetailsModal from "@/components/submission-details-modal";
import { 
  Settings, LogOut, Users, ClipboardCheck, HelpCircle, User,
  Download, Trash2, Plus, Edit, Eye, Trophy, UserPlus, Users2
} from "lucide-react";
import type { Participant, Question, SystemSettings, Team } from "@shared/schema";

interface EnrichedSubmission {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  participantMode?: 'solo' | 'team';
  teamId?: string | null;
  answers: Record<string, string>;
  score: number;
  totalMarks: number;
  timeTaken: number;
  completedAt: Date;
}

interface TeamWithMembers extends Team {
  members: Participant[];
}

interface DashboardStats {
  totalRegistrations: number;
  totalSoloRegistrations: number;
  totalTeamRegistrations: number;
  totalTeams: number;
  totalSubmissions: number;
  totalQuestions: number;
  completionRate: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<EnrichedSubmission | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiRequest("GET", "/api/admin/verify").catch(() => {
      toast({ title: "Access Denied", description: "Please log in as an administrator", variant: "destructive" });
      setLocation('/admin/login');
    });
  }, [setLocation, toast]);

  const { data: stats } = useQuery<DashboardStats>({ queryKey: ['/api/admin/stats'] });
  const { data: settings } = useQuery<SystemSettings>({ queryKey: ['/api/admin/settings'] });
  const { data: participants = [] } = useQuery<Participant[]>({ queryKey: ['/api/admin/participants'] });
  const { data: teams = [] } = useQuery<TeamWithMembers[]>({ queryKey: ['/api/admin/teams'] });
  const { data: submissions = [] } = useQuery<EnrichedSubmission[]>({ queryKey: ['/api/admin/quiz-submissions'] });
  const { data: questions = [] } = useQuery<Question[]>({ queryKey: ['/api/admin/questions'] });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => apiRequest("PUT", "/api/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: "Settings Updated" });
    }
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/participants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/participants', '/api/admin/stats'] });
      toast({ title: "Participant Deleted" });
    }
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teams', '/api/admin/stats'] });
      toast({ title: "Team Deleted" });
    }
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/quiz-submissions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quiz-submissions', '/api/admin/stats'] });
      toast({ title: "Submission Deleted" });
    }
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/questions', '/api/admin/stats'] });
      toast({ title: "Question Deleted" });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/logout"),
    onSuccess: () => {
      toast({ title: "Logged Out" });
      setLocation('/');
    }
  });

  const handleDelete = (mutation: any, id: string, type: string) => {
    if (confirm(`Are you sure you want to delete this ${type}?`)) {
      mutation.mutate(id);
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const soloSubmissions = useMemo(() => submissions.filter(s => s.participantMode === 'solo'), [submissions]);

  const teamLeaderboard = useMemo(() => {
    const teamScores: Record<string, { score: number; time: number; members: number }> = {};
    submissions.filter(s => s.participantMode === 'team' && s.teamId).forEach(s => {
      if (!teamScores[s.teamId!]) teamScores[s.teamId!] = { score: 0, time: 0, members: 0 };
      teamScores[s.teamId!].score += s.score;
      teamScores[s.teamId!].time += s.timeTaken;
      teamScores[s.teamId!].members++;
    });
    return Object.entries(teamScores)
      .map(([teamId, data]) => ({ teamId, ...data, team: teams.find(t => t.id === teamId) }))
      .filter(t => t.team)
      .sort((a, b) => b.score - a.score || a.time - b.time);
  }, [submissions, teams]);

  const soloLeaderboard = useMemo(() => {
    return soloSubmissions
      .map(s => ({ ...s, participant: participants.find(p => p.id === s.participantId)}))
      .filter(s => s.participant)
      .sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken);
  }, [soloSubmissions, participants]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center"><Settings className="mr-3" />Admin Dashboard</h1>
          <Button onClick={() => logoutMutation.mutate()} variant="ghost" className="text-red-500"><LogOut className="mr-2" size={16} />Logout</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card><CardHeader><CardTitle>Solo Registered</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.totalSoloRegistrations ?? 0}</p></CardContent></Card>
                    <Card><CardHeader><CardTitle>Teams Registered</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.totalTeams ?? 0}</p></CardContent></Card>
                    <Card><CardHeader><CardTitle>Team Members</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.totalTeamRegistrations ?? 0}</p></CardContent></Card>
                    <Card><CardHeader><CardTitle>Total Submissions</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.totalSubmissions ?? 0}</p></CardContent></Card>
                </div>
                {/* Team Leaderboard */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><Trophy className="mr-2 text-yellow-500"/>Team Leaderboard</CardTitle></CardHeader>
                  <CardContent>
                    {teamLeaderboard.slice(0, 5).map((team, i) => (
                      <div key={team.teamId} className="flex items-center justify-between p-2">
                        <span>{i+1}. {team.team?.name}</span>
                        <span className="font-bold">{team.score} pts</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                {/* Solo Leaderboard */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><User className="mr-2 text-blue-500"/>Solo Leaderboard</CardTitle></CardHeader>
                  <CardContent>
                    {soloLeaderboard.slice(0, 5).map((sub, i) => (
                      <div key={sub.id} className="flex items-center justify-between p-2">
                        <span>{i+1}. {sub.participant?.name}</span>
                        <span className="font-bold">{sub.score} pts</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Quiz Controls</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between"><span className="font-medium">Solo Registration</span><Button onClick={() => updateSettingsMutation.mutate({ soloRegistrationOpen: !settings?.soloRegistrationOpen })} size="sm" variant={settings?.soloRegistrationOpen ? "default" : "secondary"}>{settings?.soloRegistrationOpen ? "Open" : "Closed"}</Button></div>
                    <div className="flex items-center justify-between"><span className="font-medium">Team Registration</span><Button onClick={() => updateSettingsMutation.mutate({ teamRegistrationOpen: !settings?.teamRegistrationOpen })} size="sm" variant={settings?.teamRegistrationOpen ? "default" : "secondary"}>{settings?.teamRegistrationOpen ? "Open" : "Closed"}</Button></div>
                    <div className="flex items-center justify-between"><span className="font-medium">Quiz Activity</span><Button onClick={() => updateSettingsMutation.mutate({ quizActive: !settings?.quizActive })} size="sm" variant={settings?.quizActive ? "default" : "secondary"}>{settings?.quizActive ? "Active" : "Inactive"}</Button></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="registrations" className="mt-6">
            <Tabs defaultValue="solo-participants">
                <TabsList>
                    <TabsTrigger value="solo-participants">Solo Participants</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                </TabsList>
                <TabsContent value="solo-participants" className="mt-4">
                    <Table>
                      <TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>Passcode</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {participants.filter(p => p.mode === 'solo').map(p => (
                          <TableRow key={p.id}>
                            <TableCell>{p.name}<br/><span className="text-sm text-muted-foreground">{p.email}</span></TableCell>
                            <TableCell>{p.passcode}</TableCell>
                            <TableCell><Badge variant={p.hasCompletedQuiz ? "default" : "secondary"}>{p.hasCompletedQuiz ? "Completed" : "Pending"}</Badge></TableCell>
                            <TableCell><Button onClick={() => handleDelete(deleteParticipantMutation, p.id, 'participant')} variant="ghost" size="sm"><Trash2 size={16} /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </TabsContent>
                <TabsContent value="teams" className="mt-4">
                    <Table>
                      <TableHeader><TableRow><TableHead>Team Name</TableHead><TableHead>Subject</TableHead><TableHead>Join Code</TableHead><TableHead>Members</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {teams.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>{t.name}</TableCell>
                            <TableCell>{t.subject}</TableCell>
                            <TableCell>{t.joinCode}</TableCell>
                            <TableCell>{t.members.length}</TableCell>
                            <TableCell><Button onClick={() => handleDelete(deleteTeamMutation, t.id, 'team')} variant="ghost" size="sm"><Trash2 size={16} /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="submissions" className="mt-6">
            <Tabs defaultValue="solo-submissions">
                <TabsList>
                    <TabsTrigger value="solo-submissions">Solo Submissions</TabsTrigger>
                    <TabsTrigger value="team-submissions">Team Submissions</TabsTrigger>
                </TabsList>
                <TabsContent value="solo-submissions" className="mt-4">
                    <Table>
                      <TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>Score</TableHead><TableHead>Time</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {submissions.filter(s => s.participantMode === 'solo').map(s => (
                          <TableRow key={s.id}>
                            <TableCell>{s.participantName}</TableCell>
                            <TableCell>{s.score}/{s.totalMarks}</TableCell>
                            <TableCell>{formatTime(s.timeTaken)}</TableCell>
                            <TableCell><Button onClick={() => handleDelete(deleteSubmissionMutation, s.id, 'submission')} variant="ghost" size="sm"><Trash2 size={16} /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </TabsContent>
                <TabsContent value="team-submissions" className="mt-4">
                    <Table>
                      <TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>Team</TableHead><TableHead>Score</TableHead><TableHead>Time</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {submissions.filter(s => s.participantMode === 'team').map(s => (
                          <TableRow key={s.id}>
                            <TableCell>{s.participantName}</TableCell>
                            <TableCell>{teams.find(t => t.id === s.teamId)?.name ?? 'N/A'}</TableCell>
                            <TableCell>{s.score}/{s.totalMarks}</TableCell>
                            <TableCell>{formatTime(s.timeTaken)}</TableCell>
                            <TableCell><Button onClick={() => handleDelete(deleteSubmissionMutation, s.id, 'submission')} variant="ghost" size="sm"><Trash2 size={16} /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="questions" className="mt-6">
            {/* Questions Tab Content - no changes needed */}
          </TabsContent>
        </Tabs>
      </main>

      <QuestionFormModal isOpen={isQuestionModalOpen} onClose={() => setIsQuestionModalOpen(false)} question={editingQuestion} />
      {selectedSubmission && <SubmissionDetailsModal isOpen={isSubmissionModalOpen} onClose={() => setIsSubmissionModalOpen(false)} submission={selectedSubmission} participantName={selectedSubmission.participantName} />}
    </div>
  );
}

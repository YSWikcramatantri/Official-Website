import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import QuestionFormModal from "@/components/question-form-modal";
import { 
  Settings, 
  LogOut, 
  Users, 
  ClipboardCheck, 
  HelpCircle,
  UserPlus,
  Download,
  Trash2,
  Plus,
  Edit,
  Eye
} from "lucide-react";
import type { Participant, Question, SystemSettings } from "@shared/schema";

interface QuizSubmissionWithParticipant {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  answers: Record<string, string>;
  score: number;
  totalMarks: number;
  timeTaken: number;
  completedAt: Date;
}

interface DashboardStats {
  totalRegistrations: number;
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
  const { toast } = useToast();

  // Check admin authentication on mount
  useEffect(() => {
    // In a real app, you'd verify the session here
    // For now, we'll assume the user is authenticated if they reached this page
  }, []);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/admin/stats'],
  });

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ['/api/admin/settings'],
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ['/api/admin/participants'],
  });

  const { data: submissions = [] } = useQuery<QuizSubmissionWithParticipant[]>({
    queryKey: ['/api/admin/quiz-submissions'],
  });

  const { data: questions = [] } = useQuery<Question[]>({
    queryKey: ['/api/admin/questions'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<SystemSettings>) => {
      const response = await apiRequest("PUT", "/api/admin/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: "Settings Updated",
        description: "System settings have been updated successfully",
      });
    }
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/participants/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Participant Deleted",
        description: "Participant has been removed successfully",
      });
    }
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/quiz-submissions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quiz-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Submission Deleted",
        description: "Quiz submission has been removed successfully",
      });
    }
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/questions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/questions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Question Deleted",
        description: "Question has been removed successfully",
      });
    }
  });

  const handleLogout = () => {
    // Clear session and redirect
    setLocation('/');
  };

  const toggleRegistrations = () => {
    updateSettingsMutation.mutate({
      registrationOpen: !settings?.registrationOpen
    });
  };

  const toggleQuizSubmissions = () => {
    updateSettingsMutation.mutate({
      quizActive: !settings?.quizActive
    });
  };

  const handleDeleteParticipant = (id: string) => {
    if (confirm("Are you sure you want to delete this participant?")) {
      deleteParticipantMutation.mutate(id);
    }
  };

  const handleDeleteSubmission = (id: string) => {
    if (confirm("Are you sure you want to delete this submission?")) {
      deleteSubmissionMutation.mutate(id);
    }
  };

  const handleDeleteQuestion = (id: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      deleteQuestionMutation.mutate(id);
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsQuestionModalOpen(true);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setIsQuestionModalOpen(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Settings className="text-2xl text-primary mr-3" />
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            </div>
            <Button 
              onClick={handleLogout}
              variant="ghost"
              className="text-red-600 hover:text-red-800"
            >
              <LogOut className="mr-2" size={16} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="submissions">Quiz Submissions</TabsTrigger>
            <TabsTrigger value="questions">Quiz Questions</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Stats Cards */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="bg-blue-100 p-3 rounded-full">
                          <Users className="text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm text-gray-600">Total Registrations</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {stats?.totalRegistrations || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="bg-green-100 p-3 rounded-full">
                          <ClipboardCheck className="text-green-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm text-gray-600">Quiz Submissions</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {stats?.totalSubmissions || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="bg-purple-100 p-3 rounded-full">
                          <HelpCircle className="text-purple-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm text-gray-600">Total Questions</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {stats?.totalQuestions || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Controls Panel */}
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Quiz Controls</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Registrations</span>
                        <Button
                          onClick={toggleRegistrations}
                          size="sm"
                          variant={settings?.registrationOpen ? "default" : "secondary"}
                          disabled={updateSettingsMutation.isPending}
                        >
                          {settings?.registrationOpen ? "Open" : "Closed"}
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Quiz Submissions</span>
                        <Button
                          onClick={toggleQuizSubmissions}
                          size="sm"
                          variant={settings?.quizActive ? "default" : "secondary"}
                          disabled={updateSettingsMutation.isPending}
                        >
                          {settings?.quizActive ? "Active" : "Inactive"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Registrations Tab */}
          <TabsContent value="registrations">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Participant Registrations</h2>
                  <div className="flex space-x-3">
                    <Input
                      placeholder="Search registrations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                    />
                    <Button variant="outline">
                      <Download className="mr-2" size={16} />
                      Export
                    </Button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead>Passcode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParticipants.map((participant) => (
                        <TableRow key={participant.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{participant.name}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(participant.registeredAt!).toLocaleDateString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-900">{participant.email}</div>
                            <div className="text-sm text-gray-500">{participant.phone}</div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-900">
                            {participant.institution}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {participant.passcode}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={participant.hasCompletedQuiz ? "default" : "secondary"}>
                              {participant.hasCompletedQuiz ? "Completed" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handleDeleteParticipant(participant.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submissions Tab */}
          <TabsContent value="submissions">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Quiz Submissions</h2>
                  <Button variant="outline">
                    <Download className="mr-2" size={16} />
                    Export
                  </Button>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>Time Taken</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{submission.participantName}</div>
                              <div className="text-sm text-gray-500">{submission.participantEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="text-2xl font-bold text-green-600">{submission.score}</div>
                              <div className="ml-2">
                                <div className="text-sm text-gray-900">out of {submission.totalMarks}</div>
                                <div className="text-xs text-gray-500">
                                  {Math.round((submission.score / submission.totalMarks) * 100)}%
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-900">
                            {Object.keys(submission.answers).length}/{questions.length} answered
                          </TableCell>
                          <TableCell className="text-sm text-gray-900">
                            {formatTime(submission.timeTaken)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(submission.completedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm" className="text-primary hover:text-indigo-700">
                                <Eye size={16} className="mr-1" />
                                View
                              </Button>
                              <Button
                                onClick={() => handleDeleteSubmission(submission.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-800">Quiz Questions</h2>
                <Button onClick={handleAddQuestion}>
                  <Plus className="mr-2" size={16} />
                  Add Question
                </Button>
              </div>

              <div className="space-y-4">
                {questions.map((question, index) => (
                  <Card key={question.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Badge className="mr-3">Q{index + 1}</Badge>
                            <span className="text-sm text-gray-500">
                              Time: {question.timeLimit}s
                            </span>
                            <span className="text-sm text-gray-500 ml-4">
                              Marks: {question.marks}
                            </span>
                          </div>
                          <h3 className="text-lg font-medium text-gray-800 mb-3">
                            {question.text}
                          </h3>
                          
                          <div className="grid md:grid-cols-2 gap-2 mb-4">
                            {Object.entries(question.options).map(([key, value]) => (
                              <div 
                                key={key}
                                className={`flex items-center p-2 rounded-lg ${
                                  question.correctAnswer === key 
                                    ? 'bg-green-50' 
                                    : 'bg-gray-50'
                                }`}
                              >
                                <span className="w-6 h-6 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                                  {key}
                                </span>
                                <span className="text-sm">{value}</span>
                                {question.correctAnswer === key && (
                                  <div className="ml-2 text-green-500">✓</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 ml-4">
                          <Button
                            onClick={() => handleEditQuestion(question)}
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            onClick={() => handleDeleteQuestion(question.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Question Form Modal */}
      <QuestionFormModal
        isOpen={isQuestionModalOpen}
        onClose={() => {
          setIsQuestionModalOpen(false);
          setEditingQuestion(null);
        }}
        question={editingQuestion}
      />
    </div>
  );
}

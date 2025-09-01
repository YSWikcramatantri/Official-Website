import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertParticipantSchema, insertTeamSchema } from "@shared/schema";
import type { InsertParticipant, InsertTeam, SystemSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Satellite,
  User,
  Users,
  UserPlus,
  Key,
  CheckCircle2,
  Clock,
  Target,
  Trophy,
  ClipboardCopy,
  ClipboardCheck
} from "lucide-react";
import { z } from "zod";

const passcodeSchema = z.object({
  passcode: z.string().min(6, "Passcode must be 6 characters").max(6, "Passcode must be 6 characters"),
});

const joinTeamSchema = insertParticipantSchema.extend({
  joinCode: z.string().min(8, "Join code must be 8 characters").max(8, "Join code must be 8 characters"),
});

type JoinTeam = z.infer<typeof joinTeamSchema>;

export default function Home() {
  const [, setLocation] = useLocation();
  const [generatedPasscode, setGeneratedPasscode] = useState<string>("");
  const [generatedJoinCode, setGeneratedJoinCode] = useState<string>("");
  const [copied, setCopied] = useState<"passcode" | "joincode" | null>(null);
  const { toast } = useToast();

  const { data: settings } = useQuery<Partial<SystemSettings>>({
    queryKey: ['/api/settings'],
  });

  const soloForm = useForm<InsertParticipant>({
    resolver: zodResolver(insertParticipantSchema),
    defaultValues: { name: "", email: "", phone: "", institution: "" },
  });

  const createTeamForm = useForm<InsertTeam>({
    resolver: zodResolver(insertTeamSchema),
    defaultValues: { name: "", subject: "" },
  });

  const joinTeamForm = useForm<JoinTeam>({
    resolver: zodResolver(joinTeamSchema),
    defaultValues: { name: "", email: "", phone: "", institution: "", joinCode: "" },
  });

  const passcodeForm = useForm<{ passcode: string }>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const soloRegisterMutation = useMutation({
    mutationFn: (data: InsertParticipant) => apiRequest("POST", "/api/participants", data).then(res => res.json()),
    onSuccess: (data) => {
      setGeneratedPasscode(data.passcode);
      toast({ title: "Registration Successful!", description: `Your passcode is ${data.passcode}.` });
      soloForm.reset();
    },
    onError: (error: any) => toast({ title: "Registration Failed", description: error.message, variant: "destructive" }),
  });

  const createTeamMutation = useMutation({
    mutationFn: (data: InsertTeam) => apiRequest("POST", "/api/teams", data).then(res => res.json()),
    onSuccess: (data) => {
      setGeneratedJoinCode(data.joinCode);
      toast({ title: "Team Created!", description: `Your team join code is ${data.joinCode}.` });
      createTeamForm.reset();
    },
    onError: (error: any) => toast({ title: "Team Creation Failed", description: error.message, variant: "destructive" }),
  });

  const joinTeamMutation = useMutation({
    mutationFn: (data: JoinTeam) => apiRequest("POST", "/api/participants/join-team", data).then(res => res.json()),
    onSuccess: (data) => {
      setGeneratedPasscode(data.passcode);
      toast({ title: "Joined Team Successfully!", description: `Your passcode is ${data.passcode}.` });
      joinTeamForm.reset();
    },
    onError: (error: any) => toast({ title: "Failed to Join Team", description: error.message, variant: "destructive" }),
  });

  const verifyPasscodeMutation = useMutation({
    mutationFn: (data: { passcode: string }) => apiRequest("POST", "/api/participants/verify", data).then(res => res.json()),
    onSuccess: (data) => {
      sessionStorage.setItem("participant", JSON.stringify(data.participant));
      toast({ title: "Passcode Verified!", description: `Welcome ${data.participant.name}! Starting quiz...` });
      setTimeout(() => setLocation("/quiz"), 1000);
    },
    onError: (error: any) => toast({ title: "Invalid Passcode", description: error.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string, type: "passcode" | "joincode") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({ title: "Copied!", description: `${type === 'passcode' ? 'Passcode' : 'Join code'} copied to clipboard.` });
    setTimeout(() => setCopied(null), 2000);
  };

  const registrationTabs = [
    { value: "solo", label: "Solo Registration", icon: User, enabled: settings?.soloRegistrationOpen },
    { value: "create-team", label: "Create Team", icon: UserPlus, enabled: settings?.teamRegistrationOpen },
    { value: "join-team", label: "Join Team", icon: Users, enabled: settings?.teamRegistrationOpen },
  ].filter(tab => tab.enabled);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary to-secondary text-white dark:from-primary/90 dark:to-secondary/90">
        <div className="container mx-auto px-4 py-8 text-center">
          <Satellite className="mx-auto mb-4" size={48} />
          <h1 className="text-4xl font-bold">Sivali Astronomy Union</h1>
          <p className="text-xl opacity-90">Explore the Universe Through Knowledge</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8 border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 text-primary" /> Quiz Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 text-center">
              <div className="flex flex-col items-center"><Clock className="h-8 w-8 text-primary mb-2" /><h3 className="font-semibold mb-1">Timed Questions</h3><p className="text-sm text-muted-foreground">Each question has a specific time limit.</p></div>
              <div className="flex flex-col items-center"><Target className="h-8 w-8 text-primary mb-2" /><h3 className="font-semibold mb-1">Multiple Choice</h3><p className="text-sm text-muted-foreground">Select the best answer from the options.</p></div>
              <div className="flex flex-col items-center"><CheckCircle2 className="h-8 w-8 text-primary mb-2" /><h3 className="font-semibold mb-1">One Attempt</h3><p className="text-sm text-muted-foreground">You can only take the quiz once.</p></div>
            </CardContent>
          </Card>

          <Tabs defaultValue="participate" className="w-full">
            <TabsList className={`grid w-full grid-cols-${registrationTabs.length > 0 ? registrationTabs.length + 1 : 1}`}>
              {registrationTabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2"><tab.icon className="h-4 w-4" />{tab.label}</TabsTrigger>
              ))}
              <TabsTrigger value="participate" className="flex items-center gap-2"><Key className="h-4 w-4" />Participate</TabsTrigger>
            </TabsList>

            {/* Solo Registration Tab */}
            <TabsContent value="solo" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-center flex items-center justify-center gap-2"><User className="h-5 w-5" />Solo Participant Registration</CardTitle></CardHeader>
                <CardContent>
                  <Form {...soloForm}>
                    <form onSubmit={soloForm.handleSubmit(data => soloRegisterMutation.mutate(data))} className="space-y-4">
                      {/* Common participant form fields */}
                      <FormField control={soloForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Enter your full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={soloForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="Enter your email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={soloForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="Enter your phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={soloForm.control} name="institution" render={({ field }) => (<FormItem><FormLabel>School/Institution</FormLabel><FormControl><Input placeholder="Enter your school" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={soloRegisterMutation.isPending}>{soloRegisterMutation.isPending ? "Registering..." : "Register & Get Passcode"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Create Team Tab */}
            <TabsContent value="create-team" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-center flex items-center justify-center gap-2"><UserPlus className="h-5 w-5" />Create a New Team</CardTitle></CardHeader>
                <CardContent>
                  <Form {...createTeamForm}>
                    <form onSubmit={createTeamForm.handleSubmit(data => createTeamMutation.mutate(data))} className="space-y-4">
                      <FormField control={createTeamForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Team Name</FormLabel><FormControl><Input placeholder="Enter your team name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={createTeamForm.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="e.g., Astrophysics, Planetary Science" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={createTeamMutation.isPending}>{createTeamMutation.isPending ? "Creating Team..." : "Create Team & Get Join Code"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Join Team Tab */}
            <TabsContent value="join-team" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-center flex items-center justify-center gap-2"><Users className="h-5 w-5" />Join an Existing Team</CardTitle></CardHeader>
                <CardContent>
                  <Form {...joinTeamForm}>
                    <form onSubmit={joinTeamForm.handleSubmit(data => joinTeamMutation.mutate(data))} className="space-y-4">
                      <FormField control={joinTeamForm.control} name="joinCode" render={({ field }) => (<FormItem><FormLabel>Team Join Code</FormLabel><FormControl><Input placeholder="Enter 8-character join code" {...field} maxLength={8} style={{ textTransform: "uppercase" }} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
                      <hr/>
                      {/* Common participant form fields */}
                      <FormField control={joinTeamForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Enter your full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={joinTeamForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="Enter your email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={joinTeamForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="Enter your phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={joinTeamForm.control} name="institution" render={({ field }) => (<FormItem><FormLabel>School/Institution</FormLabel><FormControl><Input placeholder="Enter your school" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={joinTeamMutation.isPending}>{joinTeamMutation.isPending ? "Joining Team..." : "Join Team & Get Passcode"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Code Display Area */}
            {(generatedPasscode || generatedJoinCode) && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="text-center">
                  <CheckCircle2 className="text-green-600 mb-2 mx-auto" size={32} />
                  <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                    {generatedPasscode ? "Registration Successful!" : "Team Created Successfully!"}
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                    {generatedPasscode ? "Your unique passcode is:" : "Your team's unique join code is:"}
                  </p>
                  <div className="text-3xl font-bold font-mono text-green-800 dark:text-green-300 tracking-widest bg-white dark:bg-gray-800 p-3 rounded border flex items-center justify-center gap-3">
                    <span>{generatedPasscode || generatedJoinCode}</span>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedPasscode || generatedJoinCode, generatedPasscode ? "passcode" : "joincode")} className="h-8 px-2 text-xs">
                      {copied ? <ClipboardCheck size={14} /> : <ClipboardCopy size={14} />}
                      <span className="ml-2">Copy</span>
                    </Button>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-3">
                    Save this code! You'll need it to {generatedPasscode ? "access the quiz" : "share with your team members"}.
                  </p>
                </div>
              </div>
            )}

            <TabsContent value="participate" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-center flex items-center justify-center gap-2"><Key className="h-5 w-5" />Start Quiz</CardTitle></CardHeader>
                <CardContent>
                  <Form {...passcodeForm}>
                    <form onSubmit={passcodeForm.handleSubmit(data => verifyPasscodeMutation.mutate(data))} className="space-y-4">
                      <FormField control={passcodeForm.control} name="passcode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enter Your Passcode</FormLabel>
                          <FormControl>
                            <Input {...field} className="text-center text-2xl font-mono tracking-widest" placeholder="XXXXXX" maxLength={6} style={{ textTransform: "uppercase" }} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full bg-secondary hover:bg-purple-800" disabled={verifyPasscodeMutation.isPending}>{verifyPasscodeMutation.isPending ? "Verifying..." : "Start Quiz"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
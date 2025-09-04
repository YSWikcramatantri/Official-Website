import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertParticipantSchema } from "@shared/schema";
import type { SystemSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Satellite, User, Users, Key, CheckCircle2, Trophy, ClipboardCopy } from "lucide-react";
import { z } from "zod";

const SUBJECTS = ["Astrophysics", "Observational Astronomy", "Rocketry", "Cosmology", "General Astronomy"];

const passcodeSchema = z.object({
  passcode: z.string().min(6, "Passcode must be 6 characters").max(6, "Passcode must be 6 characters"),
});

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
    .length(5, "5 members are required"),
});

type SchoolRegistration = z.infer<typeof schoolRegistrationSchema>;
type GeneratedPasscode = { name: string; passcode: string; subject: string };

export default function Home() {
  const [, setLocation] = useLocation();
  const [generatedPasscodes, setGeneratedPasscodes] = useState<GeneratedPasscode[]>([]);
  const [registeredSchool, setRegisteredSchool] = useState<{ name: string; team: string } | null>(null);
  const { toast } = useToast();

  const { data: settings } = useQuery<Partial<SystemSettings>>({ queryKey: ['/api/settings'] });

  const soloForm = useForm<{ name: string; email: string; phone: string; institution?: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        institution: z.string().optional(),
      }),
    ),
    defaultValues: { name: "", email: "", phone: "" },
  });

  const schoolForm = useForm<SchoolRegistration>({
    resolver: zodResolver(schoolRegistrationSchema),
    defaultValues: {
      schoolName: "",
      team: "A",
      members: SUBJECTS.map(subject => ({
        name: "",
        email: "",
        phone: "",
        subject,
        isLeader: false,
      })),
    },
  });
  const { fields } = useFieldArray({ control: schoolForm.control, name: "members" });

  const passcodeForm = useForm<{ passcode: string }>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const soloRegisterMutation = useMutation({
    mutationFn: (data: { name: string; email: string; phone: string; institution?: string }) => apiRequest("POST", "/api/participants", data).then(res => res.json()),
    onSuccess: (data) => {
      setGeneratedPasscodes(data.newParticipants);
      toast({ title: "Registration Successful!" });
      soloForm.reset();
    },
    onError: (error: any) => toast({ title: "Registration Failed", description: error.message, variant: "destructive" }),
  });

  const schoolRegisterMutation = useMutation({
    mutationFn: (data: SchoolRegistration) => apiRequest("POST", "/api/schools/register", data).then(res => res.json()),
    onSuccess: (data) => {
      setGeneratedPasscodes(data.newParticipants);
      setRegisteredSchool({ name: data.school?.name ?? '', team: data.school?.team ?? 'A' });
      toast({ title: "School Registration Successful!" });
      schoolForm.reset();
    },
    onError: (error: any) => toast({ title: "Registration Failed", description: error.message, variant: "destructive" }),
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Passcodes copied to clipboard." });
  };

  const registrationTabs = [
    { value: "solo", label: "Solo Registration", icon: User, enabled: settings?.soloRegistrationOpen },
    { value: "school", label: "School Registration", icon: Users, enabled: settings?.schoolRegistrationOpen },
  ].filter(tab => tab.enabled);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary to-secondary text-white dark:from-primary/90 dark:to-secondary/90 text-center py-8">
        <Satellite className="mx-auto mb-4" size={48} />
        <h1 className="text-4xl font-bold">Sivali Astronomy Union</h1>
        <p className="text-xl opacity-90">Explore the Universe Through Knowledge</p>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="participate" className="w-full">
            <TabsList className={`grid w-full grid-cols-${registrationTabs.length > 0 ? registrationTabs.length + 1 : 1}`}>
              {registrationTabs.map(tab => <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2"><tab.icon className="h-4 w-4" />{tab.label}</TabsTrigger>)}
              <TabsTrigger value="participate" className="flex items-center gap-2"><Key className="h-4 w-4" />Participate</TabsTrigger>
            </TabsList>

            {/* Solo Registration */}
            <TabsContent value="solo">
              <Card>
                <CardHeader><CardTitle>Solo Passcode</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={async () => {
                    try {
                      const res = await apiRequest("POST", "/api/participants/solo-passcode");
                      const data = await res.json();
                      setGeneratedPasscodes([{ name: data.participant.name, passcode: data.passcode, subject: "" }]);
                      toast({ title: "Passcode Generated" });
                    } catch (e: any) {
                      toast({ title: "Failed to generate", description: e.message, variant: "destructive" });
                    }
                  }} className="w-full">Generate Solo Passcode</Button>
                  {generatedPasscodes.length > 0 && (
                    <div className="p-4 border rounded">
                      <div className="font-mono text-lg flex justify-between"><span>Passcode:</span><span>{generatedPasscodes[0].passcode}</span></div>
                      <Button className="mt-3" onClick={() => copyToClipboard(generatedPasscodes[0].passcode)}>Copy</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* School Registration */}
            <TabsContent value="school">
              <Card>
                <CardHeader><CardTitle>School Team Registration</CardTitle></CardHeader>
                <CardContent>
                  <Form {...schoolForm}>
                    <form onSubmit={schoolForm.handleSubmit(
                      (data) => schoolRegisterMutation.mutate(data),
                      () => toast({ title: "Fix the highlighted fields", variant: "destructive" })
                    )} className="space-y-6">
                      <FormField control={schoolForm.control} name="schoolName" render={({ field }) => (<FormItem><FormLabel>School Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />

                      <div className="mb-2">
                        <FormLabel>Team</FormLabel>
                        <RadioGroup defaultValue="A" onValueChange={(v) => schoolForm.setValue('team', v as any)} className="flex gap-6 mt-2">
                          <div className="flex items-center gap-2"><RadioGroupItem value="A" id="teamA" /><label htmlFor="teamA">Team A</label></div>
                          <div className="flex items-center gap-2"><RadioGroupItem value="B" id="teamB" /><label htmlFor="teamB">Team B</label></div>
                        </RadioGroup>
                      </div>

                      <RadioGroup onValueChange={(value) => schoolForm.setValue('members', schoolForm.getValues('members').map((m, i) => ({...m, isLeader: i === parseInt(value)})))}>
                        {fields.map((field, index) => (
                          <Card key={field.id} className="p-4">
                            <FormField control={schoolForm.control} name={`members.${index}.subject`} render={({ field }) => (<FormItem><FormLabel>Subject: {field.value}</FormLabel><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <FormField control={schoolForm.control} name={`members.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={schoolForm.control} name={`members.${index}.email`} render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={schoolForm.control} name={`members.${index}.phone`} render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormItem className="flex flex-col justify-center items-center">
                                <FormLabel>Team Leader</FormLabel>
                                <FormControl><RadioGroupItem value={index.toString()} /></FormControl>
                              </FormItem>
                            </div>
                          </Card>
                        ))}
                      </RadioGroup>

                      <Button type="submit" className="w-full" disabled={schoolRegisterMutation.isPending}>{schoolRegisterMutation.isPending ? "Registering School..." : "Register School & Get Passcodes"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passcode Display */}
            {generatedPasscodes.length > 0 && (
              <Card className="mt-6">
                <CardHeader><CardTitle className="flex items-center"><CheckCircle2 className="mr-2 text-green-500" />Registration Successful!</CardTitle></CardHeader>
                <CardContent>
                  <p>Please save the following passcodes. Each member will need their unique passcode to access the quiz.</p>
                  {registeredSchool && (
                    <div className="mb-2 text-sm text-muted-foreground">School: <strong>{registeredSchool.name}</strong> • Team: <strong>{registeredSchool.team}</strong></div>
                  )}
                  <div className="my-4 p-4 border rounded-md">
                    {generatedPasscodes.map(p => <div key={p.passcode} className="font-mono flex justify-between"><span>{p.name} ({p.subject}):</span><span>{p.passcode}</span></div>)}
                  </div>
                  <Button onClick={() => copyToClipboard(generatedPasscodes.map(p => `${p.name} (${p.subject}): ${p.passcode}`).join('\n'))}><ClipboardCopy className="mr-2" />Copy All</Button>
                </CardContent>
              </Card>
            )}

            {/* Participate Tab */}
            <TabsContent value="participate">
              {/* ... participate form ... */}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

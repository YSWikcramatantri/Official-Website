import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertParticipantSchema } from "@shared/schema";
import type { InsertParticipant } from "@shared/schema";
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
  UserPlus,
  Key,
  CheckCircle2,
  Clock,
  Target,
  Trophy
} from "lucide-react";
import { z } from "zod";

const passcodeSchema = z.object({
  passcode: z.string().min(6).max(6),
});

export default function Home() {
  const [, setLocation] = useLocation();
  const [generatedPasscode, setGeneratedPasscode] = useState<string>("");
  const { toast } = useToast();

  const registrationForm = useForm<InsertParticipant>({
    resolver: zodResolver(insertParticipantSchema.extend({
      name: insertParticipantSchema.shape.name.min(1, "Name is required"),
      email: insertParticipantSchema.shape.email.min(1, "Email is required"),
      phone: insertParticipantSchema.shape.phone.min(1, "Phone number is required"),
      institution: insertParticipantSchema.shape.institution.min(1, "Institution is required"),
    })),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      institution: "",
    },
  });

  const passcodeForm = useForm<{ passcode: string }>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: {
      passcode: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertParticipant) => {
      const response = await apiRequest("POST", "/api/participants", data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedPasscode(data.passcode);
      toast({
        title: "Registration Successful!",
        description: `Your passcode is ${data.passcode}. Save it to access the quiz.`,
      });
      registrationForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: "Unable to register. Please check your details and try again.",
        variant: "destructive",
      });
    },
  });

  const verifyPasscodeMutation = useMutation({
    mutationFn: async (data: { passcode: string }) => {
      const response = await apiRequest("POST", "/api/participants/verify", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Store participant data in session storage
      sessionStorage.setItem("participant", JSON.stringify(data.participant));
      toast({
        title: "Passcode Verified!",
        description: `Welcome ${data.participant.name}! Starting quiz...`,
      });
      setTimeout(() => setLocation("/quiz"), 1000);
    },
    onError: (error) => {
      toast({
        title: "Invalid Passcode",
        description: "Please check your passcode and try again.",
        variant: "destructive",
      });
    },
  });

  const handleRegistration = (data: InsertParticipant) => {
    registerMutation.mutate(data);
  };

  const handleQuizAccess = (data: { passcode: string }) => {
    verifyPasscodeMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-secondary text-white dark:from-primary/90 dark:to-secondary/90">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Satellite className="text-4xl mr-4" size={48} />
              <h1 className="text-4xl font-bold">Sivali Astronomy Union</h1>
            </div>
            <p className="text-xl opacity-90">
              Explore the Universe Through Knowledge
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Quiz Instructions */}
          <Card className="mb-8 border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Quiz Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="flex flex-col items-center">
                  <Clock className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Timed Questions</h3>
                  <p className="text-sm text-muted-foreground">Each question has a specific time limit. Answer quickly and accurately!</p>
                </div>
                <div className="flex flex-col items-center">
                  <Target className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Multiple Choice</h3>
                  <p className="text-sm text-muted-foreground">Select the best answer from the given options for each astronomy question.</p>
                </div>
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">One Attempt</h3>
                  <p className="text-sm text-muted-foreground">You can only take the quiz once, so make your answers count!</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registration and Participation Tabs */}
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Register
              </TabsTrigger>
              <TabsTrigger value="participate" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Participate
              </TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center flex items-center justify-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    New Participant Registration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...registrationForm}>
                    <form
                      onSubmit={registrationForm.handleSubmit(handleRegistration)}
                      className="space-y-4"
                    >
                      <FormField
                        control={registrationForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your full name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registrationForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Enter your email"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registrationForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="Enter your phone number"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registrationForm.control}
                        name="institution"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>School/Institution</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your school" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending
                          ? "Registering..."
                          : "Register & Get Passcode"}
                      </Button>
                    </form>
                  </Form>

                  {/* Passcode Display */}
                  {generatedPasscode && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="text-center">
                        <CheckCircle2 className="text-green-600 mb-2 mx-auto" size={32} />
                        <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                          Registration Successful!
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                          Your unique passcode is:
                        </p>
                        <div className="text-3xl font-bold font-mono text-green-800 dark:text-green-300 tracking-widest bg-white dark:bg-gray-800 p-3 rounded border flex items-center justify-center gap-3">
                          <span>{generatedPasscode}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedPasscode);
                              toast({
                                title: "Copied!",
                                description: "Passcode copied to clipboard",
                              });
                            }}
                            className="h-8 px-2 text-xs"
                            data-testid="button-copy-passcode"
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-3">
                          Save this passcode! You'll need it to access the quiz.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="participate" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center flex items-center justify-center gap-2">
                    <Key className="h-5 w-5" />
                    Start Quiz
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...passcodeForm}>
                    <form
                      onSubmit={passcodeForm.handleSubmit(handleQuizAccess)}
                      className="space-y-4"
                    >
                      <FormField
                        control={passcodeForm.control}
                        name="passcode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Enter Your Passcode</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="text-center text-2xl font-mono tracking-widest"
                                placeholder="XXXXXX"
                                maxLength={6}
                                style={{ textTransform: "uppercase" }}
                                onChange={(e) =>
                                  field.onChange(e.target.value.toUpperCase())
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-secondary hover:bg-purple-800"
                        disabled={verifyPasscodeMutation.isPending}
                      >
                        {verifyPasscodeMutation.isPending
                          ? "Verifying..."
                          : "Start Quiz"}
                      </Button>
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
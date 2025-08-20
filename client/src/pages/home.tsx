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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Satellite, UserPlus, Key, CircleOff, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const passcodeSchema = z.object({
  passcode: z.string().min(6).max(6)
});

export default function Home() {
  const [, setLocation] = useLocation();
  const [generatedPasscode, setGeneratedPasscode] = useState<string>("");
  const { toast } = useToast();

  const registrationForm = useForm<InsertParticipant>({
    resolver: zodResolver(insertParticipantSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      institution: ""
    }
  });

  const passcodeForm = useForm<{ passcode: string }>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: {
      passcode: ""
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertParticipant) => {
      const response = await apiRequest("POST", "/api/participants", data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedPasscode(data.passcode);
      registrationForm.reset();
      toast({
        title: "Registration Successful!",
        description: "Your passcode has been generated. Save it to access the quiz.",
      });
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const verifyPasscodeMutation = useMutation({
    mutationFn: async (data: { passcode: string }) => {
      const response = await apiRequest("POST", "/api/participants/verify", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Store participant data in sessionStorage for quiz access
      sessionStorage.setItem('participant', JSON.stringify(data.participant));
      setLocation('/quiz');
    },
    onError: (error) => {
      toast({
        title: "Invalid Passcode",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleRegistration = (data: InsertParticipant) => {
    registerMutation.mutate(data);
  };

  const handleQuizAccess = (data: { passcode: string }) => {
    verifyPasscodeMutation.mutate(data);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-secondary text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Satellite className="text-4xl mr-4" size={48} />
              <h1 className="text-4xl font-bold">Sivali Astronomy Union</h1>
            </div>
            <p className="text-xl opacity-90">Explore the Universe Through Knowledge</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Astronomy Quiz Challenge</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Test your knowledge of the cosmos! Register to receive your unique passcode and embark on an astronomical journey through our timed quiz.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Registration Card */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <UserPlus className="text-4xl text-primary mb-4 mx-auto" size={48} />
                  <h3 className="text-2xl font-semibold text-gray-800">New Participant</h3>
                  <p className="text-gray-600">Register to get your quiz passcode</p>
                </div>

                <Form {...registrationForm}>
                  <form onSubmit={registrationForm.handleSubmit(handleRegistration)} className="space-y-4">
                    <FormField
                      control={registrationForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
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
                            <Input type="email" placeholder="Enter your email" {...field} />
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
                            <Input type="tel" placeholder="Enter your phone number" {...field} />
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
                          <FormLabel>Institution/Organization</FormLabel>
                          <FormControl>
                            <Input placeholder="School, University, or Organization" {...field} />
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
                      {registerMutation.isPending ? "Registering..." : "Register & Get Passcode"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Quiz Access Card */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <Key className="text-4xl text-secondary mb-4 mx-auto" size={48} />
                  <h3 className="text-2xl font-semibold text-gray-800">Start Quiz</h3>
                  <p className="text-gray-600">Enter your passcode to begin</p>
                </div>

                <Form {...passcodeForm}>
                  <form onSubmit={passcodeForm.handleSubmit(handleQuizAccess)} className="space-y-4">
                    <FormField
                      control={passcodeForm.control}
                      name="passcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passcode</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              className="text-center text-2xl font-mono tracking-widest"
                              placeholder="XXXXXX"
                              maxLength={6}
                              style={{ textTransform: 'uppercase' }}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
                      {verifyPasscodeMutation.isPending ? "Verifying..." : "Start Quiz"}
                    </Button>
                  </form>
                </Form>

                {/* Passcode Display */}
                {generatedPasscode && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-center">
                      <CheckCircle2 className="text-green-500 text-2xl mb-2 mx-auto" size={32} />
                      <p className="text-green-800 font-semibold mb-2">Registration Successful!</p>
                      <p className="text-sm text-green-700 mb-3">Your unique passcode is:</p>
                      <div className="bg-white border-2 border-green-300 rounded-lg p-4">
                        <span className="text-3xl font-mono font-bold text-green-800 tracking-widest">
                          {generatedPasscode}
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-2">Save this passcode - you'll need it to access the quiz</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quiz Instructions */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-8">
            <h4 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
              <CircleOff className="mr-2" />
              Quiz Instructions
            </h4>
            <div className="grid md:grid-cols-2 gap-6 text-blue-700">
              <div>
                <h5 className="font-semibold mb-2">Before You Start:</h5>
                <ul className="space-y-1 text-sm">
                  <li>• Ensure stable internet connection</li>
                  <li>• You can only take the quiz once</li>
                  <li>• Have a quiet environment ready</li>
                  <li>• Quiz cannot be paused once started</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold mb-2">During the Quiz:</h5>
                <ul className="space-y-1 text-sm">
                  <li>• Each question has a time limit</li>
                  <li>• Questions auto-advance when time expires</li>
                  <li>• Choose the best answer from 4 options</li>
                  <li>• Timer shows remaining time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

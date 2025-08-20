import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import QuizTimer from "@/components/quiz-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Participant, Question } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface QuizQuestion extends Omit<Question, 'correctAnswer'> {
  // Remove correctAnswer from client-side question type
}

export default function Quiz() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [startTime] = useState(Date.now());
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const submissionInProgress = useRef(false);

  // Get participant from session storage
  const participant = JSON.parse(sessionStorage.getItem('participant') || '{}') as Participant;

  // Redirect if no participant data
  useEffect(() => {
    if (!participant.id) {
      setLocation('/');
      return;
    }
  }, [participant.id, setLocation]);

  const { data: questions = [], isLoading } = useQuery<QuizQuestion[]>({
    queryKey: ['/api/questions'],
    enabled: !!participant.id,
  });

  const submitQuizMutation = useMutation({
    mutationFn: async (submissionData: {
      participantId: string;
      answers: Record<string, string>;
      timeTaken: number;
    }) => {
      const response = await apiRequest("POST", "/api/quiz-submissions", submissionData);
      return response.json();
    },
    onSuccess: (data) => {
      submissionInProgress.current = false;
      setIsQuizCompleted(true);
      toast({
        title: "Quiz Completed!",
        description: "Thank you for participating! Your submission has been recorded.",
      });
      
      // Clear participant data and redirect after a delay
      setTimeout(() => {
        sessionStorage.removeItem('participant');
        setLocation('/');
      }, 3000);
    },
    onError: (error) => {
      submissionInProgress.current = false;
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Unable to submit your quiz. Please try again.",
        variant: "destructive",
      });
    }
  });

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNextQuestion = useCallback(() => {
    if (submissionInProgress.current) return;

    // Save current answer
    if (currentQuestion && selectedAnswer) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: selectedAnswer
      }));
    }

    // Move to next question or complete quiz
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer("");
    } else {
      completeQuiz();
    }
  }, [currentQuestion, selectedAnswer, currentQuestionIndex, questions.length]);

  const handleTimeUp = useCallback(() => {
    if (submissionInProgress.current || isQuizCompleted) return;
    handleNextQuestion();
  }, [handleNextQuestion, isQuizCompleted]);

  const completeQuiz = useCallback(() => {
    if (submissionInProgress.current || isQuizCompleted) return;
    
    submissionInProgress.current = true;
    
    const finalAnswers = selectedAnswer && currentQuestion 
      ? { ...answers, [currentQuestion.id]: selectedAnswer }
      : answers;
    
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    console.log('Submitting quiz:', {
      participantId: participant.id,
      answers: finalAnswers,
      timeTaken,
      questionsAnswered: Object.keys(finalAnswers).length,
      totalQuestions: questions.length
    });
    
    submitQuizMutation.mutate({
      participantId: participant.id,
      answers: finalAnswers,
      timeTaken
    });
  }, [selectedAnswer, currentQuestion, answers, startTime, participant.id, isQuizCompleted, questions.length, submitQuizMutation]);

  // Auto-submit when all questions are completed or quiz should end
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex >= questions.length && !isQuizCompleted && !submissionInProgress.current) {
      completeQuiz();
    }
  }, [currentQuestionIndex, questions.length, isQuizCompleted, completeQuiz]);

  const handleSkipQuestion = () => {
    handleNextQuestion();
  };

  if (!participant.id) {
    return null; // Will redirect
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading quiz questions...</p>
        </div>
      </div>
    );
  }

  if (isQuizCompleted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Card className="bg-gray-800 text-white max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-4">Quiz Completed!</h2>
            <p className="text-gray-300 mb-6">
              Thank you for participating in the Sivali Astronomy Union Quiz Challenge.
            </p>
            <p className="text-sm text-gray-400">
              Redirecting to homepage in a few seconds...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Card className="bg-gray-800 text-white max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">No Questions Available</h2>
            <p className="text-gray-300 mb-6">
              The quiz is currently not available. Please contact the administrator.
            </p>
            <Button onClick={() => setLocation('/')} variant="outline">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        
        {/* Quiz Header */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Astronomy Quiz</h1>
              <p className="text-gray-400">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="text-center">
              <QuizTimer
                timeLimit={currentQuestion.timeLimit}
                onTimeUp={handleTimeUp}
                key={`${currentQuestionIndex}-${currentQuestion.id}`} // Reset timer for each question
              />
              <p className="text-sm text-gray-400 mt-2">Time Left</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>

        {/* Question Card */}
        <Card className="bg-white text-gray-800 mb-8">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-6">
              {currentQuestion.text}
            </h2>

            {/* MCQ Options */}
            <div className="space-y-4 mb-8">
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <label 
                  key={key}
                  className={`quiz-option ${selectedAnswer === key ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={key}
                    checked={selectedAnswer === key}
                    onChange={(e) => handleAnswerSelect(e.target.value)}
                    className="mr-4 text-primary"
                  />
                  <span className="font-medium text-gray-700">{key}.</span>
                  <span className="ml-2">{value}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={handleSkipQuestion}
                className="text-gray-600 hover:text-gray-800"
              >
                Skip Question
              </Button>
              <Button
                onClick={handleNextQuestion}
                disabled={submitQuizMutation.isPending}
                className="bg-primary hover:bg-indigo-700"
              >
                {currentQuestionIndex === questions.length - 1 
                  ? submitQuizMutation.isPending 
                    ? "Submitting..." 
                    : "Submit Quiz"
                  : "Next Question"
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

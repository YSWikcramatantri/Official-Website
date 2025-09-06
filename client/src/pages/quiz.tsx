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
    queryKey: ['/api/questions', participant.mode, participant.subject],
    enabled: !!participant.id,
    queryFn: async () => {
      const mode = participant.mode;
      const subject = (participant.subject as string) || '';
      const passcode = (participant.passcode as string) || '';
      const params = [] as string[];
      if (mode) params.push(`mode=${encodeURIComponent(mode)}`);
      if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
      if (passcode) params.push(`passcode=${encodeURIComponent(passcode)}`);
      const query = params.length ? `?${params.join('&')}` : '';
      const res = await apiRequest('GET', `/api/questions${query}`);
      return res.json();
    }
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
    <div 
      className="min-h-screen bg-gray-900 text-white quiz-protection"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        pointerEvents: 'auto',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <style>{`
        .quiz-protection * {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
        .quiz-protection {
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        /* Disable print */
        @media print {
          .quiz-protection {
            display: none !important;
          }
        }
        /* Hide content when dev tools are open */
        @media (max-width: 1200px) and (max-height: 800px) {
          .quiz-protection {
            filter: blur(5px);
          }
        }
      `}</style>
      <div className="container mx-auto px-4 py-8">
        <script dangerouslySetInnerHTML={{
          __html: `
            // Comprehensive keyboard shortcut blocking
            document.addEventListener('keydown', function(e) {
              // Block F12, F11, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+A, Ctrl+P, Ctrl+Shift+S, PrintScreen
              if (e.keyCode === 123 || // F12
                  e.keyCode === 122 || // F11 
                  e.keyCode === 44 ||  // Print Screen
                  (e.ctrlKey && e.keyCode === 83) ||  // Ctrl+S
                  (e.ctrlKey && e.shiftKey && e.keyCode === 83) || // Ctrl+Shift+S
                  (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
                  (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
                  (e.ctrlKey && e.keyCode === 85) ||  // Ctrl+U
                  (e.ctrlKey && e.keyCode === 65) ||  // Ctrl+A
                  (e.ctrlKey && e.keyCode === 80) ||  // Ctrl+P
                  (e.ctrlKey && e.keyCode === 67) ||  // Ctrl+C
                  (e.ctrlKey && e.keyCode === 86) ||  // Ctrl+V
                  (e.ctrlKey && e.keyCode === 88) ||  // Ctrl+X
                  (e.ctrlKey && e.keyCode === 82) ||  // Ctrl+R
                  (e.ctrlKey && e.shiftKey && e.keyCode === 82)) { // Ctrl+Shift+R
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
              }
            }, true);
            
            // Block PrintScreen specifically
            document.addEventListener('keyup', function(e) {
              if (e.keyCode === 44) {
                e.preventDefault();
                return false;
              }
            }, true);
            
            // Disable right click completely
            document.addEventListener('contextmenu', function(e) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }, true);
            
            // Disable text selection and copy
            document.addEventListener('selectstart', function(e) {
              e.preventDefault();
              return false;
            }, true);
            
            document.addEventListener('copy', function(e) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }, true);
            
            // Monitor for screenshot attempts
            let screenshotAttempts = 0;
            window.addEventListener('blur', function() {
              screenshotAttempts++;
              document.body.style.filter = 'blur(10px)';
              if (screenshotAttempts > 3) {
                alert('Multiple screenshot attempts detected. Quiz will be terminated.');
                window.location.href = '/';
              }
            });
            
            window.addEventListener('focus', function() {
              setTimeout(() => {
                document.body.style.filter = 'none';
              }, 100);
            });
            
            // Advanced dev tools detection
            let devtools = {open: false, orientation: null};
            setInterval(function() {
              if (window.outerHeight - window.innerHeight > 200 || 
                  window.outerWidth - window.innerWidth > 200) {
                if (!devtools.open) {
                  devtools.open = true;
                  document.body.style.display = 'none';
                  alert('Developer tools detected. Please close them to continue the quiz.');
                  window.location.href = '/';
                }
              } else {
                devtools.open = false;
              }
            }, 500);
            
            // Disable drag and drop
            document.addEventListener('dragstart', function(e) {
              e.preventDefault();
              return false;
            }, true);
            
            // Monitor for tab switching
            document.addEventListener('visibilitychange', function() {
              if (document.hidden) {
                document.body.style.filter = 'blur(10px)';
              } else {
                setTimeout(() => {
                  document.body.style.filter = 'none';
                }, 200);
              }
            });
          `
        }} />
        
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
                  style={{ userSelect: 'none' }}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={key}
                    checked={selectedAnswer === key}
                    onChange={(e) => handleAnswerSelect(e.target.value)}
                    className="mr-4 accent-[hsl(var(--primary))] focus:outline-none"
                    data-testid={`input-option-${key}`}
                  />
                  <span className="font-medium text-[hsl(var(--card-foreground))]">{key}.</span>
                  <span className="ml-2 text-[hsl(var(--card-foreground))]">{value}</span>
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

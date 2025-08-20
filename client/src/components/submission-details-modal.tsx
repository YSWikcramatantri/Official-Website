import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Question } from "@shared/schema";

interface SubmissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any;
  participantName: string;
}

export default function SubmissionDetailsModal({
  isOpen,
  onClose,
  submission,
  participantName
}: SubmissionDetailsModalProps) {
  const { data: questions = [] } = useQuery<Question[]>({
    queryKey: ['/api/admin/questions'],
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnswerStatus = (questionId: string, correctAnswer: string) => {
    const userAnswer = submission.answers[questionId];
    if (!userAnswer) return { status: 'unanswered', color: 'bg-gray-100 text-gray-800' };
    
    const isCorrect = userAnswer === correctAnswer;
    return {
      status: isCorrect ? 'correct' : 'incorrect',
      color: isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Submission Details - {participantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{submission.score}</div>
                <div className="text-sm text-muted-foreground">Score</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{submission.totalMarks}</div>
                <div className="text-sm text-muted-foreground">Total Marks</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((submission.score / submission.totalMarks) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Percentage</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Clock className="h-5 w-5" />
                  {formatTime(submission.timeTaken)}
                </div>
                <div className="text-sm text-muted-foreground">Time Taken</div>
              </CardContent>
            </Card>
          </div>

          {/* Question-by-Question Analysis */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Question Analysis</h3>
            {questions.map((question, index) => {
              const answerStatus = getAnswerStatus(question.id, question.correctAnswer);
              const userAnswer = submission.answers[question.id];
              
              return (
                <Card key={question.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium">Question {index + 1}</h4>
                      <div className="flex items-center gap-2">
                        <Badge className={answerStatus.color}>
                          {answerStatus.status === 'correct' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {answerStatus.status === 'incorrect' && <XCircle className="h-3 w-3 mr-1" />}
                          {answerStatus.status.charAt(0).toUpperCase() + answerStatus.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {question.marks} marks
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm mb-3">{question.text}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(question.options).map(([optionKey, optionValue], optIndex) => {
                        const isUserAnswer = userAnswer === optionKey;
                        const isCorrectAnswer = question.correctAnswer === optionKey;
                        
                        return (
                          <div
                            key={optionKey}
                            className={`p-2 rounded border ${
                              isCorrectAnswer ? 'bg-green-50 border-green-200' :
                              isUserAnswer && !isCorrectAnswer ? 'bg-red-50 border-red-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <span className="font-medium">{optionKey}.</span> {optionValue}
                            {isUserAnswer && (
                              <span className="ml-2 text-xs">
                                {isCorrectAnswer ? '(Your answer ✓)' : '(Your answer ✗)'}
                              </span>
                            )}
                            {isCorrectAnswer && !isUserAnswer && (
                              <span className="ml-2 text-xs text-green-600">(Correct answer)</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
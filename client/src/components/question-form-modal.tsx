import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuestionSchema } from "@shared/schema";
import type { InsertQuestion, Question } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  question?: Question | null;
}

export default function QuestionFormModal({ isOpen, onClose, question }: QuestionFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!question;

  const form = useForm<InsertQuestion>({
    resolver: zodResolver(insertQuestionSchema),
    defaultValues: {
      text: "",
      options: { A: "", B: "", C: "", D: "" },
      correctAnswer: "A",
      timeLimit: 60,
      marks: 5,
      orderIndex: 1,
      mode: 'both'
    }
  });

  // Reset form when question changes
  useEffect(() => {
    if (question) {
      form.reset({
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        timeLimit: question.timeLimit,
        marks: question.marks,
        orderIndex: question.orderIndex,
        mode: (question as any).mode ?? 'both'
      });
    } else {
      form.reset({
        text: "",
        options: { A: "", B: "", C: "", D: "" },
        correctAnswer: "A",
        timeLimit: 60,
        marks: 5,
        orderIndex: 1,
        mode: 'both'
      });
    }
  }, [question, form]);

  const createQuestionMutation = useMutation({
    mutationFn: async (data: InsertQuestion) => {
      const response = await apiRequest("POST", "/api/admin/questions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/questions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Question Created",
        description: "New question has been added successfully",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Question",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: InsertQuestion) => {
      const response = await apiRequest("PUT", `/api/admin/questions/${question!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/questions'] });
      toast({
        title: "Question Updated",
        description: "Question has been updated successfully",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Question",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: InsertQuestion) => {
    if (isEditing) {
      updateQuestionMutation.mutate(data);
    } else {
      createQuestionMutation.mutate(data);
    }
  };

  const isPending = createQuestionMutation.isPending || updateQuestionMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Question" : "Add New Question"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Text</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3}
                      placeholder="Enter your question here..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timeLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Limit (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="60"
                        min="10"
                        max="300"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="marks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marks</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="5"
                        min="1"
                        max="10"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="orderIndex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Order</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="1"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-4 block">Answer Options</Label>
              <div className="space-y-3">
                {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                  <div key={letter} className="flex items-center space-x-3">
                    <FormField
                      control={form.control}
                      name="correctAnswer"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="flex"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value={letter} id={`correct-${letter}`} />
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                      {letter}
                    </span>
                    <FormField
                      control={form.control}
                      name={`options.${letter}`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input 
                              placeholder={`Enter option ${letter}`}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Select the radio button next to the correct answer</p>
            </div>

            <FormField control={form.control} name="mode" render={({ field }) => (
              <FormItem>
                <FormLabel>Mode</FormLabel>
                <FormControl>
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name="mode" value="solo" checked={field.value === 'solo'} onChange={() => field.onChange('solo')} />
                      <span>Solo</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name="mode" value="team" checked={field.value === 'team'} onChange={() => field.onChange('team')} />
                      <span>Team</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name="mode" value="both" checked={field.value === 'both'} onChange={() => field.onChange('both')} />
                      <span>Both</span>
                    </label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Update Question" : "Save Question"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

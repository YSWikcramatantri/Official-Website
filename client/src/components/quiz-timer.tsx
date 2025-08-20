import { useState, useEffect } from "react";

interface QuizTimerProps {
  timeLimit: number; // in seconds
  onTimeUp: () => void;
}

export default function QuizTimer({ timeLimit, onTimeUp }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    setTimeLeft(timeLimit);
  }, [timeLimit]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const getTimerClass = () => {
    if (timeLeft <= 10) return "quiz-timer critical";
    if (timeLeft <= 20) return "quiz-timer warning";
    return "quiz-timer";
  };

  return (
    <div className={getTimerClass()}>
      <span>{displayTime}</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getTimeUntilNextStudyReset } from "@/lib/date-utils";

interface NextStudyResetTimerProps {
  customHour?: number;
}

export function NextStudyResetTimer({ customHour = 0 }: NextStudyResetTimerProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setMounted(true);
    
    // Atualiza imediatamente
    const updateTimer = () => {
      setTimeLeft(getTimeUntilNextStudyReset(new Date(), customHour));
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [customHour]);

  if (!mounted) {
    return <span className="opacity-40 animate-pulse">...</span>;
  }

  const { hours, minutes, seconds } = timeLeft;

  // Formatação Premium baseada no tempo restante
  let displayString = "";
  if (hours > 0) {
    displayString = `${hours}h ${minutes}min`;
  } else if (minutes > 0) {
    displayString = `${minutes}min`;
  } else {
    displayString = `${seconds}s`;
  }

  return (
    <span className="font-bold tracking-tight text-accent dark:text-accent-foreground/90 tabular-nums">
      {displayString}
    </span>
  );
}

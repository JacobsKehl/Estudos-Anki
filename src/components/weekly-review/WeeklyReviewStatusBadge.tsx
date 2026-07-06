"use client";

import React from "react";
import { SessionStatus, mapSessionStatus, getStatusBadgeClasses } from "@/lib/weekly-review-ui";

interface Props {
  status: SessionStatus;
  className?: string;
}

export function WeeklyReviewStatusBadge({ status, className = "" }: Props) {
  const classes = getStatusBadgeClasses(status);
  const text = mapSessionStatus(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${classes} ${className}`}>
      {text}
    </span>
  );
}

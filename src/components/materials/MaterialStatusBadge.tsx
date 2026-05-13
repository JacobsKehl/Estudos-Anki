import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type MaterialStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "ERROR";

interface MaterialStatusBadgeProps {
  status: MaterialStatus;
  className?: string;
}

export function MaterialStatusBadge({ status, className }: MaterialStatusBadgeProps) {
  switch (status) {
    case "PROCESSED":
      return (
        <Badge variant="success" className={className}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Concluído
        </Badge>
      );
    case "PROCESSING":
      return (
        <Badge className={`bg-blue-100 text-blue-700 hover:bg-blue-200 border-transparent ${className}`}>
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Extraindo...
        </Badge>
      );
    case "ERROR":
      return (
        <Badge className={`bg-error-bg text-error-text hover:bg-red-200 border-transparent ${className}`}>
          <AlertCircle className="w-3 h-3 mr-1" />
          Erro
        </Badge>
      );
    case "PENDING":
    default:
      return (
        <Badge variant="secondary" className={className}>
          <Clock className="w-3 h-3 mr-1" />
          Aguardando
        </Badge>
      );
  }
}

"use client";

import { SubmitStatus } from "@/lib/types";
import { Circle, CheckCircle } from "lucide-react";

interface Props {
  status: SubmitStatus;
}

export default function StatusBadge({ status }: Props) {
  if (status === "submitted") {
    return (
      <span className="status-badge-submitted">
        <CheckCircle size={12} />
        제출완료
      </span>
    );
  }
  return (
    <span className="status-badge-draft">
      <Circle size={12} />
      작성중
    </span>
  );
}

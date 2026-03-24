"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Department, Report } from "@/lib/types";
import DepartmentEditor from "@/components/DepartmentEditor";
import { Loader2 } from "lucide-react";

export default function EditorPage() {
  const params = useParams<{ reportId: string; deptId: string }>();
  const reportId = parseInt(params.reportId);
  const deptId = parseInt(params.deptId);

  const [dept, setDept] = useState<Department | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.departments.get(deptId), api.reports.get(reportId)])
      .then(([d, r]) => { setDept(d); setReport(r); })
      .catch((e) => setError(e.message));
  }, [reportId, deptId]);

  if (error)
    return (
      <div className="text-center py-20" style={{ color: "var(--danger)" }}>
        오류: {error}
      </div>
    );
  if (!dept || !report)
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="animate-spin mr-2" size={20} />
        불러오는 중...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto">
      <DepartmentEditor
        reportId={reportId}
        deptId={deptId}
        dept={dept}
        report={report}
      />
    </div>
  );
}

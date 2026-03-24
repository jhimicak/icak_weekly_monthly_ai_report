"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Department, Report } from "@/lib/types";
import { FileText, ArrowRight, Loader2, Plus } from "lucide-react";
import CreateReportModal from "@/components/CreateReportModal";
import { toast } from "@/components/Toast";

export default function HomePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [pendingDept, setPendingDept] = useState<Department | null>(null);

  useEffect(() => {
    Promise.all([api.departments.list(), api.reports.list()])
      .then(([d, r]) => {
        setDepartments(d);
        setReports(r);
        if (r.length > 0) setSelectedReport(r[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (report: Report) => {
    setReports((prev) => [report, ...prev]);
    setSelectedReport(report.id);
    setShowModal(false);
    toast("success", "새 보고서가 생성되었습니다.");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="animate-spin mr-2" size={20} />
        불러오는 중...
      </div>
    );

  const report = reports.find((r) => r.id === selectedReport);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          🗂️ 스마트 리포트 허브
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          부서별 주간·월간 업무보고를 웹에서 손쉽게 작성하고 제출하세요.
        </p>
      </div>

      {/* 보고서 선택 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex xl:items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <span className="text-lg">📋</span> 보고서 선택
          </h2>
          <button
            className="btn-primary"
            onClick={() => setShowModal(true)}
            style={{ padding: "6px 12px" }}
          >
            <Plus size={14} />
            새 보고서
          </button>
        </div>
        
        {reports.length > 0 ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
                    selectedReport === r.id ? "border-transparent" : ""
                  }`}
                  style={{
                    background: selectedReport === r.id ? "var(--accent)" : "var(--bg-card-hover)",
                    color: selectedReport === r.id ? "#fff" : "var(--text-secondary)",
                    borderColor: selectedReport === r.id ? "transparent" : "var(--border)",
                  }}
                >
                  {r.title}
                </button>
              ))}
            </div>
            {report && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                기간: {report.start_date} ~ {report.end_date} &nbsp;·&nbsp;
                유형: {report.type === "weekly" ? "주간" : "월간"}
              </p>
            )}
          </>
        ) : (
          <div className="text-center p-4 border border-dashed rounded-lg" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            등록된 보고서가 없습니다. 새 보고서를 만들어보세요.
          </div>
        )}
      </div>

      {/* 부서 목록 */}
      {selectedReport && departments.length > 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <span className="text-lg">🏢</span> 부서 선택
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => {
                  setPendingDept(dept);
                  setShowTypeModal(true);
                }}
                className="flex items-center justify-between p-4 rounded-xl border transition-all duration-150 hover:scale-[1.01] text-left w-full"
                style={{
                  background: "var(--bg-card-hover)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--accent)1a", color: "var(--accent)" }}
                  >
                    <FileText size={16} />
                  </div>
                  <span className="font-medium text-sm">{dept.name}</span>
                </div>
                <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <CreateReportModal 
          onClose={() => setShowModal(false)} 
          onCreated={handleCreated} 
        />
      )}

      {showTypeModal && pendingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                작성 방식 선택
              </h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {pendingDept.name}의 보고서 작성 방식을 선택하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link
                href={`/editor/${selectedReport}/${pendingDept.id}`}
                className="flex flex-col items-center justify-center p-5 rounded-xl border transition-all hover:bg-indigo-50/30 group"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-2xl mb-2">💻</span>
                <span className="font-semibold text-sm">홈페이지에서 직접 입력</span>
                <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>웹 에디터를 사용하여 작성</span>
              </Link>

              <Link
                href={`/editor/${selectedReport}/${pendingDept.id}?fileMode=true`}
                className="flex flex-col items-center justify-center p-5 rounded-xl border transition-all hover:bg-indigo-50/30 group"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-2xl mb-2">📄</span>
                <span className="font-semibold text-sm">주간보고 파일 업로드</span>
                <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>HWP를 PDF로 변환하여 업로드</span>
              </Link>
            </div>

            <button
              onClick={() => setShowTypeModal(false)}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

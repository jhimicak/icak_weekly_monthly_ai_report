"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Department, Report, DeptStatus } from "@/lib/types";
import { FileText, ArrowRight, Loader2, Plus } from "lucide-react";
import CreateReportModal from "@/components/CreateReportModal";
import { toast } from "@/components/Toast";

export default function HomePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [pendingDept, setPendingDept] = useState<Department | null>(null);
  const [statuses, setStatuses] = useState<DeptStatus[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedReport || !pendingDept) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isHwp = ext === "hwp" || ext === "hwpx";
    const isPdf = file.type === "application/pdf" || ext === "pdf";

    if (!isHwp && !isPdf) {
      toast("error", "HWP 또는 PDF 파일만 업로드 가능합니다.");
      return;
    }
    if (!supabase) {
      toast("error", "Supabase 설정이 필요합니다. 관리자에게 문의해주세요.");
      return;
    }

    setUploading(true);
    try {
      let uploadFile: File | Blob = file;

      if (isHwp) {
        toast("success", "HWP 파일을 PDF로 변환 중...");
        const pdfBlob = await api.convert.hwp2pdf(file);
        uploadFile = pdfBlob;
      }

      const fileName = `${selectedReport}_${pendingDept.id}_${Date.now()}.pdf`;
      const { error } = await supabase.storage.from("reports").upload(fileName, uploadFile, {
        upsert: true,
        contentType: "application/pdf",
      });
      if (error) throw error;

      const { data: publicData } = supabase.storage.from("reports").getPublicUrl(fileName);

      await api.reports.submit(selectedReport, pendingDept.id, {
        submission_type: "file",
        file_url: publicData.publicUrl,
      });

      toast("success", isHwp ? "HWP가 PDF로 변환되어 제출되었습니다." : "PDF 파일이 성공적으로 제출되었습니다.");
      setShowTypeModal(false);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "파일 업로드 및 제출에 실패했습니다.";
      toast("error", msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    Promise.all([api.departments.list(), api.reports.list()])
      .then(([d, r]) => {
        setDepartments(d);
        setReports(r);
        if (r.length > 0) setSelectedReport(r[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedReport) return;
    api.reports.statuses(selectedReport)
      .then(setStatuses)
      .catch(console.error);
  }, [selectedReport]);

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
            {departments.map((dept) => {
              const isSubmitted = statuses.find(s => s.dept_id === dept.id)?.status === "submitted";
              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setPendingDept(dept);
                    setShowTypeModal(true);
                  }}
                  className="flex items-center justify-between p-4 rounded-xl border transition-all duration-150 hover:scale-[1.01] text-left w-full relative overflow-hidden"
                  style={{
                    background: isSubmitted ? "var(--bg-card)" : "var(--bg-card-hover)",
                    borderColor: isSubmitted ? "var(--success)" : "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: isSubmitted ? "rgba(34,197,94,0.12)" : "var(--accent)1a", color: isSubmitted ? "var(--success)" : "var(--accent)" }}
                    >
                      <FileText size={16} />
                    </div>
                    <div>
                      <span className="font-medium text-sm block">{dept.name}</span>
                      {isSubmitted && (
                         <span className="text-[10px] font-bold text-emerald-600 mt-0.5 block">제출 완료됨</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: isSubmitted ? "var(--success)" : "var(--text-muted)" }} />
                </button>
              );
            })}
          </div>
        </div>
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
              {statuses.find(s => s.dept_id === pendingDept.id)?.status === "submitted" && (
                <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-800 text-[13px] font-medium flex items-start text-left gap-2 leading-relaxed">
                  <span className="shrink-0 text-base">⚠️</span>
                  <span>이미 <strong>제출이 완료된 부서</strong>입니다.<br/>새로운 방식으로 작성(제출) 시 기존 내용이 덮어씌워집니다.</span>
                </div>
              )}
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

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center p-5 rounded-xl border transition-all hover:bg-indigo-50/30 group disabled:opacity-50"
                style={{ borderColor: "var(--border)", cursor: uploading ? "not-allowed" : "pointer", width: "100%" }}
              >
                {uploading ? (
                  <Loader2 className="animate-spin mb-2" size={24} style={{ color: "var(--accent)" }} />
                ) : (
                  <span className="text-2xl mb-2">📄</span>
                )}
                <span className="font-semibold text-sm">
                  {uploading ? "업로드 및 변환 중..." : "주간보고 파일 업로드"}
                </span>
                <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>HWP를 PDF로 변환하여 업로드</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".hwp,.hwpx,.pdf,application/pdf"
                onChange={handleFileUpload}
              />
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

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Report, DeptStatus, AggregateResult } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "@/components/Toast";
import {
  ExternalLink, Building2, Plus, Trash2, Download,
  Loader2, RefreshCw, BarChart3,
  ChevronUp, ChevronDown, FileDown, Sparkles
} from "lucide-react";
import { generateMergedPdf } from "@/lib/pdfBuilder";
import CreateReportModal from "@/components/CreateReportModal";
import EditReportModal from "@/components/EditReportModal";

const LEVEL_SYMBOL: Record<number, string> = { 1: "□", 2: "ㅇ", 3: "-", 4: "·" };
const LEVEL_INDENT: Record<number, string> = {
  1: "ml-0 font-semibold",
  2: "ml-4",
  3: "ml-8 text-sm",
  4: "ml-12 text-sm",
};

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<DeptStatus[]>([]);
  const [aggregate, setAggregate] = useState<AggregateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);
  const [showAggregate, setShowAggregate] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [aiSummarizing, setAiSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  
  // Department Management
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptLoading, setDeptLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.reports.list(), api.departments.list()])
      .then(([r, d]) => {
        setReports(r);
        setDepartments(d);
        if (r.length > 0) setSelectedReport(r[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadStatuses = useCallback(async () => {
    if (!selectedReport) return;
    setLoading(true);
    try {
      const s = await api.reports.statuses(selectedReport);
      setStatuses(s);
    } finally {
      setLoading(false);
    }
  }, [selectedReport]);

  useEffect(() => {
    setAggregate(null);
    setShowAggregate(false);
    setAiSummary(null);
    loadStatuses();
  }, [loadStatuses]);

  const handleAggregate = async () => {
    if (!selectedReport) return;
    setAggregating(true);
    setAggregate(null);
    try {
      const data = await api.reports.aggregate(selectedReport);
      setAggregate(data);
      setShowAggregate(true);
      setTimeout(() => {
        document.getElementById("aggregate-preview")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      toast("error", "취합에 실패했습니다.");
    } finally {
      setAggregating(false);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!aggregate) return;
    setAiSummarizing(true);
    try {
      const sections = aggregate.sections.map(sec => {
        if (sec.dept.submission_type === "file") {
          return {
            dept_name: sec.dept.name,
            text: "",
            file_url: sec.dept.file_url || null,
          };
        } else {
          const achievements = sec.items.filter(i => i.category === "achievement").map(i => i.content).join("\n");
          const plans = sec.items.filter(i => i.category === "plan").map(i => i.content).join("\n");
          return {
            dept_name: sec.dept.name,
            text: `실적:\n${achievements}\n계획:\n${plans}`,
            file_url: null,
          };
        }
      });

      const res = await api.ai.summarizeReport(sections);
      setAiSummary(res.summary);
      toast("success", "AI 총괄 요약이 생성되었습니다.");
    } catch (e: any) {
      toast("error", "AI 요약 생성 실패: " + (e.message || ""));
    } finally {
      setAiSummarizing(false);
    }
  };

  const calculateNextWeek = (dateStr: string) => {
    const end = new Date(dateStr);
    if (isNaN(end.getTime())) return "";
    const nextStart = new Date(end);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 6);
    
    const fmt = (d: Date) => {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${m}.${dd}`;
    };
    return `${fmt(nextStart)}\n~\n${fmt(nextEnd)}`;
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setDeptLoading(true);
    try {
      const d = await api.departments.create(newDeptName.trim());
      setDepartments((prev) => [...prev, d]);
      setNewDeptName("");
      toast("success", "부서가 추가되었습니다.");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "추가 실패");
    } finally {
      setDeptLoading(false);
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm("정말 이 부서를 삭제하시겠습니까?")) return;
    try {
      await api.departments.delete(id);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      toast("success", "부서가 삭제되었습니다.");
    } catch (e: unknown) {
      toast("error", "삭제 실패. 이미 사용 중인 부서일 수 있습니다.");
    }
  };

  const handleDeleteSubmission = async (deptId: number, deptName: string) => {
    if (!selectedReport) return;
    if (!confirm(`'${deptName}' 부서의 전체 작성 내역을 삭제(초기화)하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await api.items.deleteAll(selectedReport, deptId);
      toast("success", "제출 내역이 초기화되었습니다.");
      loadStatuses();
    } catch (e: unknown) {
      toast("error", "초기화 실패");
    }
  };

  const handleCreated = (report: Report) => {
    setReports((prev) => [report, ...prev]);
    setSelectedReport(report.id);
    setShowCreateModal(false);
    toast("success", "새 보고서가 생성되었습니다.");
  };

  const handleUpdated = (updated: Report) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setShowEditModal(false);
    toast("success", "보고서가 수정되었습니다.");
  };

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    if (!confirm("정말 이 보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 부서의 작성 내용이 전부 삭제됩니다!")) return;
    try {
      await api.reports.delete(selectedReport);
      setReports((prev) => prev.filter((r) => r.id !== selectedReport));
      setSelectedReport(reports.find(r => r.id !== selectedReport)?.id ?? null);
      toast("success", "보고서가 삭제되었습니다.");
    } catch {
      toast("error", "보고서 삭제 실패");
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadMerged = async (includeAiSummary: boolean) => {
    if (!aggregate) return;
    setShowPdfModal(false);
    setAggregating(true);
    try {
      await generateMergedPdf(aggregate, "aggregate-preview", includeAiSummary);
      toast("success", "통합 PDF 다운로드를 시작합니다.");
    } catch (e) {
      console.error(e);
      toast("error", "PDF 병합 중 오류가 발생했습니다.");
    } finally {
      setAggregating(false);
    }
  };

  const submittedCount = statuses.filter((s) => s.status === "submitted").length;
  const totalCount = statuses.length;
  const progressPct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  if (loading && reports.length === 0)
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="animate-spin mr-2" size={20} />
        불러오는 중...
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent)22", color: "var(--accent)" }}
          >
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              관리자 대시보드
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              부서 관리, 제출 현황 모니터링 및 취합
            </p>
          </div>
        </div>
        <button className="btn-ghost print:hidden" onClick={loadStatuses}>
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 부서 관리 */}
      <div className="card p-5 space-y-4 print:hidden">
        <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Building2 size={18} style={{ color: "var(--text-secondary)" }} />
          부서 관리
        </h2>
        
        <form onSubmit={handleAddDept} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none bg-[var(--bg-card-hover)] border-[var(--border)] focus:border-[var(--accent)]"
            placeholder="새 부서 이름..."
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={deptLoading || !newDeptName.trim()}>
            {deptLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            추가
          </button>
        </form>

        {departments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {departments.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-[var(--bg-primary)] text-sm border-[var(--border)]"
              >
                <span>{d.name}</span>
                <button
                  onClick={() => handleDeleteDept(d.id)}
                  className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 보고서 탭 */}
      <div className="card p-4 space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap flex-1">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex-shrink-0"
            style={{ padding: "6px 12px" }}
          >
            <Plus size={14} /> 새 보고서
          </button>
        </div>

        {selectedReport && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs mr-auto hidden sm:block" style={{ color: "var(--text-muted)" }}>선택된 보고서 관리</span>
            <button onClick={() => setShowEditModal(true)} className="text-sm px-3 py-1.5 rounded-md hover:bg-black/5" style={{ color: "var(--text-secondary)" }}>수정</button>
            <button onClick={handleDeleteReport} className="text-sm px-3 py-1.5 rounded-md hover:bg-red-50" style={{ color: "var(--danger)" }}>삭제</button>
          </div>
        )}
      </div>

      {/* 진행률 */}
      {selectedReport && (
        <div className="card p-5 space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              제출 현황
            </span>
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {submittedCount} / {totalCount} 부서
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100 ? "var(--success)" : "var(--accent)",
              }}
            />
          </div>
          <p className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
            {progressPct}% 완료
          </p>
        </div>
      )}

      {/* 부서별 상태판 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
        {statuses.map((s) => (
          <div
            key={s.id}
            className="card p-4 flex items-center justify-between transition-all hover:border-[var(--accent)] duration-150"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{
                  background: s.status === "submitted"
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(239,68,68,0.12)",
                  color: s.status === "submitted"
                    ? "var(--success)"
                    : "var(--danger)",
                }}
              >
                {s.dept_name[0]}
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                  {s.dept_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={s.status} />
              {selectedReport && (
                <>
                  <button
                    onClick={() => handleDeleteSubmission(s.dept_id, s.dept_name)}
                    className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    title="제출 내역 초기화"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Link
                    href={`/editor/${selectedReport}/${s.dept_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    title="에디터 열기"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 전체 취합 버튼 */}
      {selectedReport && (
        <div className="flex gap-3 justify-end flex-wrap print:hidden">
          <button
            className="btn-primary"
            onClick={handleAggregate}
            disabled={aggregating}
          >
            {aggregating ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            전체 취합 및 미리보기
          </button>
          {aggregate && (
            <>
              <button
                className="btn-primary !bg-indigo-600 hover:!bg-indigo-700"
                onClick={handleGenerateAiSummary}
                disabled={aiSummarizing}
              >
                {aiSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                AI 총괄 요약 생성
              </button>
              <button className="btn-ghost" onClick={() => setShowAggregate((v) => !v)}>
                {showAggregate ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAggregate ? "접기" : "펼치기"}
              </button>
              <button
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
                onClick={() => setShowPdfModal(true)}
                disabled={aggregating}
              >
                {aggregating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                통합 PDF 다운로드
              </button>
            </>
          )}
        </div>
      )}

      {/* 취합 결과 미리보기 */}
      {showAggregate && aggregate && (
        <div
          id="aggregate-preview"
          className="bg-white text-black p-8 mx-auto print:p-0 print:border-none print:shadow-none"
        >
          {/* 표지 (가로형) */}
          <div className="flex flex-col items-center justify-center w-full aspect-[1.414] max-w-[1050px] mx-auto page-break-after border-2 border-gray-800 p-8 mb-12 bg-white print:w-[297mm] print:h-[210mm] print:border-2">
            <h1 
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[0.2em] md:tracking-[0.4em] mb-12 text-center whitespace-nowrap pl-[0.2em] md:pl-[0.4em]" 
              style={{ fontFamily: "'Malgun Gothic', serif" }}
            >
              {aggregate.report.type === "weekly" ? "주 간 회 의 자 료" : "월 간 회 의 자 료"}
            </h1>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold mb-20 tracking-widest text-center">
              {aggregate.report.start_date.replace(/-/g, ".")} 
            </p>
            <div className="mt-16 text-center pb-4 border-t-2 border-gray-800 pt-10 w-64 md:w-80">
              <h2 className="text-3xl sm:text-4xl font-black tracking-[0.2em] md:tracking-widest text-[#005a3c]">해외건설협회</h2>
              <p className="text-sm md:text-base font-bold mt-3 text-gray-500 tracking-widest uppercase">ICAK</p>
            </div>
          </div>

          {/* AI 총괄 요약 - 가로 A4 2단 컬럼 레이아웃 */}
          {aiSummary && (() => {
            const lines = aiSummary.split("\n");
            const sec1Start = lines.findIndex(l => l.startsWith("## ") && l.match(/1\./));
            const sec2Start = lines.findIndex(l => l.startsWith("## ") && l.match(/2\./));
            const section1 = sec1Start !== -1
              ? (sec2Start !== -1 ? lines.slice(sec1Start, sec2Start) : lines.slice(sec1Start))
              : lines;
            const section2 = sec2Start !== -1 ? lines.slice(sec2Start) : [];

            // 라인 배열을 부서 블록(### 기준) 단위로 쪼갬
            const splitToDeptBlocks = (ls: string[]) => {
              const blocks: string[][] = [];
              let current: string[] = [];
              ls.forEach(line => {
                if (line.startsWith("### ") && current.length > 0) {
                  blocks.push(current);
                  current = [line];
                } else {
                  current.push(line);
                }
              });
              if (current.length > 0) blocks.push(current);
              return blocks;
            };

            // 블록 배열 → JSX 렌더
            const renderBlock = (block: string[], bIdx: number) => (
              <div key={bIdx} className="mb-3.5">
                {block.map((line, idx) => {
                  if (line.startsWith("## ")) return <h2 key={idx} className="text-sm font-bold mb-2 pb-1 border-b-2 border-gray-700">{line.replace(/^##\s*/, "")}</h2>;
                  if (line.startsWith("### ")) return <h3 key={idx} className="text-[12px] font-bold mt-1 mb-1 text-gray-800 border-l-2 border-gray-500 pl-1">{line.replace(/^###\s*/, "")}</h3>;
                  if (line.startsWith("---")) return null;
                  if (line.startsWith("- ")) return <p key={idx} className="ml-2 text-[11px] leading-snug text-gray-700">{"ㅇ "}{line.replace(/^-\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
                  if (line.trim() === "") return null;
                  return <p key={idx} className="text-[11px] text-gray-600">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
                })}
              </div>
            );


            const SummaryPage = ({ id, sectionLines }: { id: string; sectionLines: string[] }) => {
              const blocks = splitToDeptBlocks(sectionLines);
              // 헤더 블록(## 로 시작)과 부서 블록 분리
              const headerBlock = blocks[0]?.[0]?.startsWith("## ") ? blocks[0] : [];
              const deptBlocks = headerBlock.length > 0 ? blocks.slice(1) : blocks;
              const half = Math.ceil(deptBlocks.length / 2);
              const leftBlocks = deptBlocks.slice(0, half);
              const rightBlocks = deptBlocks.slice(half);

              return (
                <div
                  id={id}
                  className="relative mb-12 print:mb-0 page-break-after bg-white"
                  style={{ width: "100%", maxWidth: "1120px", margin: "0 auto 3rem" }}
                >
                  {/* 가로 A4 비율 컨테이너 */}
                  <div style={{ aspectRatio: "297/210", width: "100%", display: "flex", flexDirection: "column", padding: "24px 28px 20px" }}>
                    {/* 페이지 제목 */}
                    <div className="text-center mb-3">
                      <h2 className="text-xl font-bold tracking-[0.4em] underline underline-offset-4 decoration-2 inline-block">
                        AI 총 괄 요 약
                      </h2>
                    </div>
                    {/* 섹션 헤더 */}
                    {headerBlock.length > 0 && (
                      <div className="text-center mb-2">
                        <span className="text-sm font-bold text-gray-700">{headerBlock[0].replace(/^##\s*/, "")}</span>
                      </div>
                    )}
                    {/* 2단 컬럼 */}
                    <div className="flex-1 border-2 border-gray-800 flex gap-0 overflow-hidden">
                      {/* 좌측 컬럼 */}
                      <div className="flex-1 p-3 border-r border-gray-400 overflow-hidden">
                        {leftBlocks.map((b, i) => renderBlock(b, i))}
                      </div>
                      {/* 우측 컬럼 */}
                      <div className="flex-1 p-3 overflow-hidden">
                        {rightBlocks.map((b, i) => renderBlock(b, i + half))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                <SummaryPage id="ai-summary-block-1" sectionLines={section1} />
                {section2.length > 0 && (
                  <SummaryPage id="ai-summary-block-2" sectionLines={section2} />
                )}
              </>
            );
          })()}


          {/* 부서별 보고서 양식 */}
          {aggregate.sections.map((section) => (
            <div 
              key={section.dept.id} 
              data-dept-id={section.dept.id}
              className="relative mb-12 print:mb-0 print:min-h-[210mm] page-break-after pt-8"
            >
              
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold tracking-[0.5em] underline underline-offset-8 decoration-2 inline-block">
                  {aggregate.report.type === "weekly" ? "주 간 업 무 현 황 보 고" : "월 간 업 무 현 황 보 고"}
                </h2>
              </div>
              <div className="text-right mb-2 font-bold text-sm">
                부서명: {section.dept.name}
              </div>

              <table className="w-full border-collapse border border-gray-800 text-sm">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[42%]" />
                  <col className="w-[8%]" />
                  <col className="w-[42%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 text-center font-bold">
                    <th className="border border-gray-800 py-2">기 간</th>
                    <th className="border border-gray-800 py-2">추 진 실 적</th>
                    <th className="border border-gray-800 py-2">기 간</th>
                    <th className="border border-gray-800 py-2">추 진 계 획</th>
                  </tr>
                </thead>
                <tbody>
                  {section.dept.submission_type === "file" ? (
                    <tr>
                      <td colSpan={4} className="border border-gray-800 p-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-50">
                          <FileDown size={40} />
                          <p className="font-bold">PDF 파일 업로드 방식으로 제출됨</p>
                          <p className="text-xs">최종 통합 PDF 생성 시 해당 파일이 삽입됩니다.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td className="border border-gray-800 p-2 align-top text-center text-xs whitespace-pre-wrap">
                        {aggregate.report.start_date.slice(5).replace("-", ".")}
                        <br/>~<br/>
                        {aggregate.report.end_date.slice(5).replace("-", ".")}
                      </td>
                      <td className="border border-gray-800 p-4 align-top leading-relaxed">
                        {section.items.filter(i => i.category === "achievement").map(item => (
                          <div key={item.id} className={`flex gap-2 text-sm ${LEVEL_INDENT[item.level] || 'ml-0'} mb-1`}>
                            <span className="shrink-0">{LEVEL_SYMBOL[item.level] || '·'}</span>
                            <span className="whitespace-pre-wrap leading-tight text-gray-900">{item.content}</span>
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-800 p-2 align-top text-center text-xs whitespace-pre-wrap">
                        {calculateNextWeek(aggregate.report.end_date)}
                      </td>
                      <td className="border border-gray-800 p-4 align-top leading-relaxed">
                        {section.items.filter(i => i.category === "plan").map(item => (
                          <div key={item.id} className={`flex gap-2 text-sm ${LEVEL_INDENT[item.level] || 'ml-0'} mb-1`}>
                            <span className="shrink-0">{LEVEL_SYMBOL[item.level] || '·'}</span>
                            <span className="whitespace-pre-wrap leading-tight text-gray-900">{item.content}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}

          {aggregate.sections.length === 0 && (
            <p className="text-center py-8 text-gray-500">
              제출 완료된 부서가 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 모달 영역 */}
      {showCreateModal && (
        <CreateReportModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      )}
      {showEditModal && selectedReport && reports.find((r: any) => r.id === selectedReport) && (
        <EditReportModal
          report={reports.find((r: any) => r.id === selectedReport)!}
          onClose={() => setShowEditModal(false)}
          onUpdated={handleUpdated}
        />
      )}

      {/* PDF 다운로드 모달 */}
      {showPdfModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowPdfModal(false)}
        >
          <div
            className="card p-7 max-w-sm w-full mx-4 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>통합 PDF 다운로드</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              AI 총괄 요약 페이지를 포함하여 다운로드하시겠습니까?
            </p>
            {!aiSummary && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>
                💡 AI 요약을 포함하려면 먼저 &#39;AI 총괄 요약 생성&#39; 버튼을 눌러 요약을 생성해야 합니다.
              </p>
            )}
            <div className="flex gap-3 pt-1 flex-wrap">
              <button
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 whitespace-nowrap"
                disabled={!aiSummary}
                onClick={() => handleDownloadMerged(true)}
              >
                <Sparkles size={14} /> AI 요약 포함
              </button>
              <button
                className="btn-primary whitespace-nowrap"
                onClick={() => handleDownloadMerged(false)}
              >
                <Download size={14} /> 미포함
              </button>
              <button className="btn-ghost whitespace-nowrap" onClick={() => setShowPdfModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

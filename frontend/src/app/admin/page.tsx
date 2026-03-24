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
  ChevronUp, ChevronDown, FileDown
} from "lucide-react";
import { generateMergedPdf } from "@/lib/pdfBuilder";

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

  const handlePrint = () => window.print();

  const handleDownloadMerged = async () => {
    if (!aggregate) return;
    setAggregating(true);
    try {
      await generateMergedPdf(aggregate, "aggregate-preview");
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
        <div className="flex gap-2 flex-wrap">
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
              <button className="btn-ghost" onClick={() => setShowAggregate((v) => !v)}>
                {showAggregate ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAggregate ? "접기" : "펼치기"}
              </button>
              <button 
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" 
                onClick={handleDownloadMerged}
                disabled={aggregating}
              >
                {aggregating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                통합 PDF 다운로드
              </button>
              <button className="btn-ghost" onClick={handlePrint}>
                <FileDown size={14} />
                단순 인쇄
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
          {/* 표지 */}
          <div className="flex flex-col items-center justify-center min-h-[1050px] print:min-h-[297mm] page-break-after border border-gray-800 p-8 m-4">
            <h1 className="text-5xl font-extrabold tracking-[1em] mb-24 text-center mt-32" style={{ fontFamily: "serif" }}>
              주 간 회 의 자 료
            </h1>
            <p className="text-2xl font-bold mb-32 tracking-widest text-center">
              {aggregate.report.start_date.replace(/-/g, ".")} 
            </p>
            <div className="mt-32 text-center pb-12">
              <h2 className="text-4xl font-black tracking-widest text-[#005a3c]">해외건설협회</h2>
              <p className="text-sm font-bold mt-2 text-gray-600">ICAK</p>
            </div>
          </div>

          {/* 부서별 보고서 양식 */}
          {aggregate.sections.map((section) => (
            <div 
              key={section.dept.id} 
              data-dept-id={section.dept.id}
              className="relative mb-12 print:mb-0 print:min-h-[210mm] page-break-after pt-8"
            >
              
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold tracking-[0.5em] underline underline-offset-8 decoration-2 inline-block">
                  주 간 업 무 현 황 보 고
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
    </div>
  );
}

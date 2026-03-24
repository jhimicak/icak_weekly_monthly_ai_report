"use client";

import { useState } from "react";
import { X, Calendar, FileText, Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Report, ReportType } from "@/lib/types";

interface Props {
  onCreated: (report: Report) => void;
  onClose: () => void;
}

export default function CreateReportModal({ onCreated, onClose }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: "",
    type: "weekly" as ReportType,
    start_date: today,
    end_date: today,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("제목을 입력해주세요."); return; }
    if (form.start_date > form.end_date) { setError("종료일이 시작일보다 앞설 수 없습니다."); return; }
    setLoading(true);
    setError(null);
    try {
      const report = await api.reports.create({
        title: form.title,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      onCreated(report);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  // 주간 선택 시 자동으로 종료일을 +6일로 계산
  const handleStartDateChange = (val: string) => {
    const start = new Date(val);
    let end = val;
    if (form.type === "weekly") {
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 6);
      end = endDate.toISOString().split("T")[0];
    } else if (form.type === "monthly") {
      const endDate = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end = endDate.toISOString().split("T")[0];
    }
    setForm((f) => ({ ...f, start_date: val, end_date: end }));
  };

  const handleTypeChange = (type: ReportType) => {
    setForm((f) => ({ ...f, type }));
    handleStartDateChange(form.start_date);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card w-full max-w-md p-6 space-y-5 shadow-2xl"
        style={{ background: "var(--bg-card)" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
              새 보고서 만들기
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 보고서 유형 */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["weekly", "monthly"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className="py-2 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    background: form.type === t ? "var(--accent)" : "var(--bg-card-hover)",
                    color: form.type === t ? "#fff" : "var(--text-secondary)",
                    borderColor: form.type === t ? "transparent" : "var(--border)",
                  }}
                >
                  {t === "weekly" ? "📅 주간" : "📆 월간"}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              제목
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all"
              style={{
                background: "var(--bg-card-hover)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="예: 2026년 13주차 업무보고"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {/* 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                시작일
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }} />
                <input
                  type="date"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none"
                  style={{
                    background: "var(--bg-card-hover)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  value={form.start_date}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                종료일
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }} />
                <input
                  type="date"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none"
                  style={{
                    background: "var(--bg-card-hover)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import {
  RotateCcw, Send, CheckCircle, Loader2, Sparkles, Unlock
} from "lucide-react";
import { ReportItem, Category, Department, Report } from "@/lib/types";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import ColumnDropZone from "@/components/ColumnDropZone";

interface Props {
  reportId: number;
  deptId: number;
  dept: Department;
  report: Report;
}

type ItemMap = { achievement: ReportItem[]; plan: ReportItem[] };

/** display_order 기준 정렬 */
const sortByOrder = (items: ReportItem[]) =>
  [...items].sort((a, b) => a.display_order - b.display_order);

export default function DepartmentEditor({ reportId, deptId, dept, report }: Props) {
  const [items, setItems] = useState<ItemMap>({ achievement: [], plan: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  // Ctrl 키 상태를 ref로 관리 (re-render 없이 즉각 반영)
  const isCtrlRef = useRef(false);
  // 드래그 시작 시점의 복제 의도를 잠금 (드래그 중 Ctrl 상태 변화 무관)
  const cloneModeRef = useRef(false);

  // ── Ctrl 키 이벤트 감지 ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCtrlRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCtrlRef.current = false;
    };
    const handleBlur = () => { isCtrlRef.current = false; };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // ── 초기 데이터 로드 ──────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [achievements, plans, statuses] = await Promise.all([
        api.items.list(reportId, deptId, "achievement"),
        api.items.list(reportId, deptId, "plan"),
        api.reports.statuses(reportId),
      ]);
      setItems({
        achievement: sortByOrder(achievements),
        plan: sortByOrder(plans),
      });
      const myStatus = statuses.find((s) => s.dept_id === deptId);
      setSubmitted(myStatus?.status === "submitted");
    } finally {
      setLoading(false);
    }
  }, [reportId, deptId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ── 항목 추가 ─────────────────────────────────────────────────────────────────
  const handleAdd = async (category: Category) => {
    const newItem = await api.items.create(reportId, {
      dept_id: deptId,
      category,
      level: 1,
      content: "",
    });
    setItems((prev) => ({
      ...prev,
      [category]: [...prev[category], newItem],
    }));
  };

  // ── 항목 변경 (로컬 즉시 반영 + 디바운스 저장) ──────────────────────────────────
  const pendingRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const handleChange = (id: number, changes: Partial<ReportItem>) => {
    setItems((prev) => {
      const update = (arr: ReportItem[]) =>
        arr.map((item) => (item.id === id ? { ...item, ...changes } : item));
      return {
        achievement: update(prev.achievement),
        plan: update(prev.plan),
      };
    });
    // Debounce save
    if (pendingRef.current.has(id)) clearTimeout(pendingRef.current.get(id)!);
    pendingRef.current.set(
      id,
      setTimeout(() => {
        api.items.update(id, changes).catch(console.error);
        pendingRef.current.delete(id);
      }, 600)
    );
  };

  // ── 항목 삭제 ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    await api.items.delete(id);
    setItems((prev) => ({
      achievement: prev.achievement.filter((i) => i.id !== id),
      plan: prev.plan.filter((i) => i.id !== id),
    }));
  };

  // ── 항목 복사 (우클릭) ─────────────────────────────────────────────────────────
  const handleClone = async (id: number) => {
    let srcCol: "achievement" | "plan" = "achievement";
    let index = items.achievement.findIndex(i => i.id === id);
    if (index === -1) {
      srcCol = "plan";
      index = items.plan.findIndex(i => i.id === id);
    }
    if (index === -1) return;

    const toClone = items[srcCol][index];
    const dstCol = srcCol === "achievement" ? "plan" : "achievement";

    try {
      const newDbItem = await api.items.create(reportId, {
        dept_id: deptId,
        category: dstCol,
        level: toClone.level,
        content: toClone.content,
      });

      setItems((prev) => {
        const newDstItems = [...prev[dstCol], newDbItem];
        const rp = newDstItems.map((it, i) => ({
          id: it.id,
          display_order: i,
          category: dstCol as Category,
        }));
        api.items.reorder(rp).catch(console.error);
        return { ...prev, [dstCol]: newDstItems };
      });
      toast("success", "반대 컬럼으로 복사되었습니다.");
    } catch (error) {
      toast("error", "복사에 실패했습니다.");
    }
  };

  // ── 드래그 앤 드롭 ────────────────────────────────────────────────────────────
  // 드래그 시작 시 Ctrl 상태를 잠금 (dnd가 pointer events를 가로채기 전에 캡처)
  const onDragStart = () => {
    cloneModeRef.current = isCtrlRef.current;
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) { cloneModeRef.current = false; return; }

    const srcCol = source.droppableId.startsWith("achievement")
      ? "achievement"
      : "plan" as Category;
    const dstCol = destination.droppableId.startsWith("achievement")
      ? "achievement"
      : "plan" as Category;

    setItems((prev) => {
      const srcItems = [...prev[srcCol]];
      const dstItems = srcCol === dstCol ? srcItems : [...prev[dstCol]];

      const isClone = cloneModeRef.current && srcCol !== dstCol;
      let movedUpdated;

      if (isClone) {
        // 복제 (임시 ID 사용)
        const toClone = srcItems[source.index];
        movedUpdated = { ...toClone, id: Date.now() + Math.random(), category: dstCol };
        dstItems.splice(destination.index, 0, movedUpdated);
      } else {
        // 일반 이동
        const [moved] = srcItems.splice(source.index, 1);
        movedUpdated = { ...moved, category: dstCol };
        dstItems.splice(destination.index, 0, movedUpdated);
      }

      const newState: ItemMap = {
        achievement: srcCol === "achievement" ? srcItems : prev.achievement,
        plan: srcCol === "plan" ? srcItems : prev.plan,
      };
      if (srcCol !== dstCol) {
        newState[dstCol] = dstItems;
      } else {
        newState[srcCol] = dstItems;
      }

      // 서버 동기화 로직
      if (isClone) {
        api.items.create(reportId, {
          dept_id: deptId,
          category: dstCol,
          level: movedUpdated.level,
          content: movedUpdated.content,
        }).then((newDbItem) => {
          setItems((p2) => ({
            ...p2,
            [dstCol]: p2[dstCol].map((it) => it.id === movedUpdated.id ? { ...it, id: newDbItem.id } : it)
          }));
          const rp = newState[dstCol].map((it, i) => ({
            id: it.id === movedUpdated.id ? newDbItem.id : it.id,
            display_order: i,
            category: dstCol as Category,
          }));
          api.items.reorder(rp).catch(console.error);
        });
      } else {
        const reorderPayload = [
          ...newState.achievement.map((it, i) => ({
            id: it.id,
            display_order: i,
            category: "achievement" as Category,
          })),
          ...newState.plan.map((it, i) => ({
            id: it.id,
            display_order: i,
            category: "plan" as Category,
          })),
        ];
        api.items.reorder(reorderPayload).catch(console.error);
      }

      cloneModeRef.current = false;
      return newState;
    });
  };

  // ── 자동 이월 (Rollover) ──────────────────────────────────────────────────────
  const handleRollover = async () => {
    setRolling(true);
    try {
      const newItems = await api.items.rollover(reportId, deptId);
      setItems((prev) => ({
        ...prev,
        achievement: sortByOrder([...prev.achievement, ...newItems]),
      }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "이월 실패");
    } finally {
      setRolling(false);
    }
  };

  // ── 제출 ─────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.reports.submit(reportId, deptId);
      setSubmitted(true);
      toast("success", "보고서가 제출되었습니다.");
    } catch (e: unknown) {
      toast("error", "제출 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── 회수 ─────────────────────────────────────────────────────────────────────
  const handleRecall = async () => {
    if (!confirm("정말 제출을 회수하시겠습니까?\n회수 시 작성 중 상태로 돌아갑니다.")) return;
    setSaving(true);
    try {
      await api.reports.recall(reportId, deptId);
      setSubmitted(false);
      toast("success", "제출이 회수되었습니다.");
    } catch (e: unknown) {
      toast("error", "회수 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── AI 요약 훅 ────────────────────────────────────────────────────────────────
  const handleAiSummarize = async () => {
    const allText = [...items.achievement, ...items.plan]
      .map((i) => i.content)
      .filter(Boolean)
      .join("\n");
    if (!allText) return;
    const res = await api.ai.summarize(reportId, deptId, allText);
    setAiSummary(res.summary);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="animate-spin mr-2" size={20} />
        불러오는 중...
      </div>
    );

  return (
    <div className="space-y-4">
      {/* 헤더 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {dept.name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {report.title} &nbsp;·&nbsp; {report.start_date} ~ {report.end_date}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-ghost" onClick={handleRollover} disabled={rolling}>
            {rolling ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            지난번 계획 불러오기
          </button>
          <button className="btn-ghost" onClick={handleAiSummarize}>
            <Sparkles size={14} />
            AI 요약
          </button>
          {submitted ? (
            <div className="flex items-center gap-2">
              <span className="status-badge-submitted">
                <CheckCircle size={12} />
                제출완료
              </span>
              <button 
                className="btn-ghost !text-[var(--danger)] hover:!bg-red-500/10 border border-transparent hover:border-red-200" 
                onClick={handleRecall} 
                disabled={saving}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                제출 회수
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              제출하기
            </button>
          )}
        </div>
      </div>

      {/* AI 요약 결과 */}
      {aiSummary && (
        <div className="card px-4 py-3 text-sm" style={{ color: "var(--text-secondary)", borderColor: "#4f6ef755" }}>
          <span className="font-semibold" style={{ color: "var(--accent-light)" }}>🤖 AI 요약 &nbsp;</span>
          {aiSummary}
        </div>
      )}

      {/* 2단 에디터 */}
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ColumnDropZone
            droppableId={`achievement-${deptId}`}
            title="추진 실적"
            subtitle="금번 기간 동안 완료한 업무"
            accentColor="#22c55e"
            items={items.achievement}
            onAdd={handleAdd}
            onChange={handleChange}
            onDelete={handleDelete}
            onClone={handleClone}
          />
          <ColumnDropZone
            droppableId={`plan-${deptId}`}
            title="추진 계획"
            subtitle="다음 기간 예정 업무"
            accentColor="#4f6ef7"
            items={items.plan}
            onAdd={handleAdd}
            onChange={handleChange}
            onDelete={handleDelete}
            onClone={handleClone}
          />
        </div>
      </DragDropContext>

      {/* 도움말 */}
      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Tab → 하위단계(ㅁ→ㅇ→-) &nbsp;·&nbsp;
        Shift+Tab → 상위단계 &nbsp;·&nbsp;
        드래그로 순서 변경 및 이동 &nbsp;·&nbsp;
        <strong style={{ color: "var(--accent-light)" }}>항목 우클릭 또는 Ctrl+드래그</strong>하여 반대 컬럼 복사
      </p>
    </div>
  );
}

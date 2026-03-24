"use client";

import { useRef, useState, useEffect, KeyboardEvent } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Copy } from "lucide-react";
import { ReportItem } from "@/lib/types";

interface Props {
  item: ReportItem;
  index: number;
  onChange: (id: number, changes: Partial<ReportItem>) => void;
  onDelete: (id: number) => void;
  onClone?: (id: number) => void; // 반대 컬럼으로 복사
}

/** level에 따른 기호와 들여쓰기 */
const LEVEL_MAP: Record<number, { symbol: string; indent: string }> = {
  1: { symbol: "ㅁ", indent: "ml-0" },
  2: { symbol: "ㅇ", indent: "ml-6" },
  3: { symbol: "-",  indent: "ml-12" },
};

export default function BlockEditor({ item, index, onChange, onDelete, onClone }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { symbol, indent } = LEVEL_MAP[item.level] ?? LEVEL_MAP[1];

  // 우클릭 컨텍스트 메뉴 상태
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 컨텍스트 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    if (menu) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (item.level > 1) onChange(item.id, { level: (item.level - 1) as 1 | 2 | 3 });
      } else {
        if (item.level < 3) onChange(item.id, { level: (item.level + 1) as 1 | 2 | 3 });
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  return (
    <Draggable draggableId={String(item.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group relative flex items-start gap-2 rounded-lg px-3 py-2 border transition-all duration-150 ${indent} ${
            snapshot.isDragging ? "dnd-dragging" : ""
          }`}
          style={{
            ...provided.draggableProps.style,
            background: snapshot.isDragging
              ? "var(--bg-card-hover)"
              : "var(--bg-card)",
            borderColor: snapshot.isDragging
              ? "var(--accent)"
              : "var(--border)",
          }}
          onContextMenu={(e) => {
            if (!onClone) return;
            e.preventDefault();
            onClone(item.id);
          }}
        >
          {/* 드래그 핸들 */}
          <span
            {...provided.dragHandleProps}
            className="mt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            <GripVertical size={14} />
          </span>

          {/* 위계 기호 */}
          <span
            className="mt-[6px] shrink-0 w-5 text-center font-bold text-sm select-none"
            style={{ color: "var(--accent)" }}
          >
            {symbol}
          </span>

          {/* 본문 텍스트에어리아 */}
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed py-0.5"
            style={{
              color: "var(--text-primary)",
              minHeight: "24px",
              overflow: "hidden",
            }}
            rows={1}
            value={item.content}
            placeholder="내용을 입력하세요... (Tab: 하위단계, Shift+Tab: 상위단계)"
            onChange={(e) => {
              onChange(item.id, { content: e.target.value });
              handleInput();
            }}
            onKeyDown={handleKeyDown}
          />

          {/* 삭제 버튼 */}
          <button
            onClick={() => onDelete(item.id)}
            className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded p-0.5 hover:bg-red-500/20"
            style={{ color: "var(--danger)" }}
            title="항목 삭제"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </Draggable>
  );
}

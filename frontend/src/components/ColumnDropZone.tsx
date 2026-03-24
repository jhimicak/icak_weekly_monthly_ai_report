"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { ReportItem, Category } from "@/lib/types";
import BlockEditor from "./BlockEditor";

interface Props {
  droppableId: string;   // "achievement" | "plan"  (+ unique suffix)
  title: string;
  subtitle: string;
  accentColor: string;
  items: ReportItem[];
  onAdd: (category: Category) => void;
  onChange: (id: number, changes: Partial<ReportItem>) => void;
  onDelete: (id: number) => void;
  onClone?: (id: number) => void; // 반대 컬럼으로 복사
}

export default function ColumnDropZone({
  droppableId,
  title,
  subtitle,
  accentColor,
  items,
  onAdd,
  onChange,
  onDelete,
  onClone,
}: Props) {
  const category = droppableId.startsWith("achievement")
    ? ("achievement" as Category)
    : ("plan" as Category);

  return (
    <div
      className="flex flex-col card overflow-hidden"
      style={{ minHeight: 480 }}
    >
      {/* 헤더 */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h2 className="font-semibold text-base" style={{ color: accentColor }}>
            {title}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: `${accentColor}1a`,
            color: accentColor,
            border: `1px solid ${accentColor}33`,
          }}
        >
          {items.length}개 항목
        </span>
      </div>

      {/* Droppable 영역 */}
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 p-3 flex flex-col gap-2 transition-colors duration-150"
            style={{
              background: snapshot.isDraggingOver
                ? `${accentColor}08`
                : "transparent",
              minHeight: 200,
            }}
          >
            {items.length === 0 && !snapshot.isDraggingOver && (
              <div
                className="flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <p className="text-sm">항목이 없습니다</p>
                <p className="text-xs mt-1">아래 버튼으로 추가하거나</p>
                <p className="text-xs">반대 컬럼에서 드래그해 오세요</p>
              </div>
            )}
            {items.map((item, index) => (
              <BlockEditor
                key={item.id}
                item={item}
                index={index}
                onChange={onChange}
                onDelete={onDelete}
                onClone={onClone}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* 항목 추가 버튼 */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onAdd(category)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 border border-dashed"
          style={{
            color: accentColor,
            borderColor: `${accentColor}44`,
            background: "transparent",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = `${accentColor}10`)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
          }
        >
          <Plus size={14} />
          항목 추가 (ㅁ)
        </button>
      </div>
    </div>
  );
}

import {
  Department,
  Report,
  ReportItem,
  DeptStatus,
  AggregateResult,
  Category,
} from "./types";

// Vercel 등에 배포했을 때 렌더(Render) 백엔드 주소에 자동으로 /api 를 붙여서 라우팅 오류 방지
const url = process.env.NEXT_PUBLIC_API_URL;
const BASE = url ? (url.endsWith('/api') ? url : `${url}/api`) : "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Departments ────────────────────────────────────────────────────────────────
export const api = {
   departments: {
    list: () => req<Department[]>("/departments"),
    get: (id: number) => req<Department>(`/departments/${id}`),
    create: (name: string) =>
      req<Department>("/departments", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    delete: (id: number) => req<void>(`/departments/${id}`, { method: "DELETE" }),
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  reports: {
    list: () => req<Report[]>("/reports"),
    get: (id: number) => req<Report>(`/reports/${id}`),
    create: (payload: Omit<Report, "id">) =>
      req<Report>("/reports", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    statuses: (reportId: number) =>
      req<DeptStatus[]>(`/reports/${reportId}/statuses`),
    submit: (reportId: number, deptId: number) =>
      req<DeptStatus>(`/reports/${reportId}/submit/${deptId}`, {
        method: "POST",
      }),
    recall: (reportId: number, deptId: number) =>
      req<DeptStatus>(`/reports/${reportId}/recall/${deptId}`, {
        method: "POST",
      }),
    aggregate: (reportId: number) =>
      req<AggregateResult>(`/reports/${reportId}/aggregate`),
  },

  // ── Items ────────────────────────────────────────────────────────────────────
  items: {
    list: (reportId: number, deptId?: number, category?: Category) => {
      const params = new URLSearchParams();
      if (deptId !== undefined) params.set("dept_id", String(deptId));
      if (category) params.set("category", category);
      const qs = params.toString() ? `?${params}` : "";
      return req<ReportItem[]>(`/reports/${reportId}/items${qs}`);
    },
    create: (
      reportId: number,
      payload: {
        dept_id: number;
        category: Category;
        level: number;
        content: string;
        display_order?: number;
      }
    ) =>
      req<ReportItem>(`/reports/${reportId}/items`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      itemId: number,
      payload: Partial<Pick<ReportItem, "level" | "content" | "display_order" | "category">>
    ) =>
      req<ReportItem>(`/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    delete: (itemId: number) =>
      req<void>(`/items/${itemId}`, { method: "DELETE" }),
    reorder: (items: { id: number; display_order: number; category: Category }[]) =>
      req<{ ok: boolean }>("/items/reorder", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    deleteAll: (reportId: number, deptId: number) =>
      req<void>(`/reports/${reportId}/items/${deptId}`, { method: "DELETE" }),
    rollover: (reportId: number, deptId: number) =>
      req<ReportItem[]>(`/reports/${reportId}/rollover/${deptId}`, {
        method: "POST",
      }),
  },

  // ── AI (Placeholder) ─────────────────────────────────────────────────────────
  ai: {
    summarize: async (reportId: number, deptId: number, text: string) => {
      // TODO: 실제 AI 연동 시 이 함수를 채워넣습니다.
      return req<{ summary: string }>("/ai/summarize", {
        method: "POST",
        body: JSON.stringify({ report_id: reportId, dept_id: deptId, text }),
      });
    },
  },
};

/** 공유 타입 정의 */

export type ReportType = "weekly" | "monthly";
export type Category = "achievement" | "plan";
export type SubmitStatus = "draft" | "submitted";

export interface Department {
  id: number;
  name: string;
}

export interface Report {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  type: ReportType;
  ai_summary?: string | null;
}

export interface ReportItem {
  id: number;
  report_id: number;
  dept_id: number;
  category: Category;
  level: 1 | 2 | 3;
  content: string;
  display_order: number;
}

export interface DeptStatus {
  id: number;
  report_id: number;
  dept_id: number;
  status: SubmitStatus;
  submission_type: "direct" | "file";
  file_url?: string | null;
  dept_name: string;
  report_title: string;
}

export interface AggregateSection {
  dept: {
    id: number;
    name: string;
    submission_type: "direct" | "file";
    file_url?: string | null;
  };
  items: ReportItem[];
}

export interface AggregateResult {
  report: Report;
  sections: AggregateSection[];
}

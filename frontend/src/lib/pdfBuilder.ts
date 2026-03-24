import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { AggregateResult } from "./types";

/**
 * 전 부서의 보고서를 하나의 PDF로 병합하여 다운로드합니다.
 * 직접 작성한 부서는 HTML을 캡처하고, 파일 업로드 부서는 원본 PDF를 가져와 합칩니다.
 */
export async function generateMergedPdf(aggregate: AggregateResult, containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error("미리보기 컨테이너를 찾을 수 없습니다.");
  }

  // 1. 최종 결과물이 될 PDF 생성 (pdf-lib)
  const finalMergedPdf = await PDFDocument.create();
  
  // 미리보기 컨테이너 내의 자식 요소들 (표지 + 부서별 섹션)
  // 부서별 섹션은 data-dept-id 속성을 통해 식별 가능하도록 admin/page.tsx 수정 필요
  const children = Array.from(container.children) as HTMLElement[];
  
  // 2. 표지 처리 (항상 첫 번째 자식)
  const coverEl = children[0];
  if (coverEl) {
    const canvas = await html2canvas(coverEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
    const pdfBytes = pdf.output("arraybuffer");
    const doc = await PDFDocument.load(pdfBytes);
    const [page] = await finalMergedPdf.copyPages(doc, [0]);
    finalMergedPdf.addPage(page);
  }

  // 3. 부서별 섹션 처리
  for (const section of aggregate.sections) {
    // 해당 부서의 DOM 요소를 ID 또는 data 속성으로 찾음
    const sectionEl = children.find(child => child.getAttribute("data-dept-id") === String(section.dept.id));
    
    if (section.dept.submission_type === "file" && section.dept.file_url) {
      // 파일 업로드 방식: 외부 PDF 로드 및 병합
      try {
        const response = await fetch(section.dept.file_url);
        const fileBytes = await response.arrayBuffer();
        const externalPdf = await PDFDocument.load(fileBytes);
        const pages = await finalMergedPdf.copyPages(externalPdf, externalPdf.getPageIndices());
        pages.forEach(p => finalMergedPdf.addPage(p));
      } catch (err) {
        console.error(`${section.dept.name} PDF 로드 실패:`, err);
        // 실패 시 placeholder라도 넣거나 건너뜀
      }
    } else if (sectionEl) {
      // 직접 입력 방식: DOM 캡처 -> PDF 변환 -> 병합
      const canvas = await html2canvas(sectionEl, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      // 가로 양식이므로 landscape 설정
      const pdf = new jsPDF("l", "mm", "a4");
      pdf.addImage(imgData, "JPEG", 0, 0, 297, 210);
      
      const pdfBytes = pdf.output("arraybuffer");
      const doc = await PDFDocument.load(pdfBytes);
      const [page] = await finalMergedPdf.copyPages(doc, [0]);
      finalMergedPdf.addPage(page);
    }
  }

  // 4. 저장 및 다운로드
  const mergedPdfBytes = await finalMergedPdf.save();
  const blob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `[취합]_${aggregate.report.title}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

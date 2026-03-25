import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { AggregateResult } from "./types";

/** HTML 요소를 캡처하여 jsPDF 페이지로 변환 (비율 유지) */
async function captureElementToPdfPage(
  finalMergedPdf: PDFDocument,
  element: HTMLElement,
  orientation: "p" | "l"
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  // A4 크기: 세로 210×297mm, 가로 297×210mm
  const pageW = orientation === "l" ? 297 : 210;
  const pageH = orientation === "l" ? 210 : 297;
  const margin = 8; // mm

  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  // 캔버스의 픽셀 비율을 유지하면서 최대 영역에 맞게 조정
  const canvasRatio = canvas.width / canvas.height;
  const pageRatio = maxW / maxH;

  let imgW: number, imgH: number;
  if (canvasRatio > pageRatio) {
    // 캔버스가 더 넓음 → 너비 기준으로 맞춤
    imgW = maxW;
    imgH = maxW / canvasRatio;
  } else {
    // 캔버스가 더 높음 → 높이 기준으로 맞춤
    imgH = maxH;
    imgW = maxH * canvasRatio;
  }

  const offsetX = margin + (maxW - imgW) / 2;
  const offsetY = margin + (maxH - imgH) / 2;

  const pdf = new jsPDF(orientation, "mm", "a4");
  pdf.addImage(imgData, "JPEG", offsetX, offsetY, imgW, imgH);

  const pdfBytes = pdf.output("arraybuffer");
  const doc = await PDFDocument.load(pdfBytes);
  const [page] = await finalMergedPdf.copyPages(doc, [0]);
  finalMergedPdf.addPage(page);
}

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

  const children = Array.from(container.children) as HTMLElement[];

  // 2. 표지 처리 (항상 첫 번째 자식 — 세로 -> 가로로 변경)
  const coverEl = children[0];
  if (coverEl) {
    await captureElementToPdfPage(finalMergedPdf, coverEl, "l");
  }

  // 3. 부서별 섹션 처리
  for (const section of aggregate.sections) {
    const sectionEl = children.find(
      (child) => child.getAttribute("data-dept-id") === String(section.dept.id)
    );

    if (section.dept.submission_type === "file" && section.dept.file_url) {
      // 파일 업로드 방식: 외부 PDF 로드 및 병합
      try {
        const response = await fetch(section.dept.file_url);
        const fileBytes = await response.arrayBuffer();
        const externalPdf = await PDFDocument.load(fileBytes);
        const pages = await finalMergedPdf.copyPages(externalPdf, externalPdf.getPageIndices());
        pages.forEach((p) => finalMergedPdf.addPage(p));
      } catch (err) {
        console.error(`${section.dept.name} PDF 로드 실패:`, err);
      }
    } else if (sectionEl) {
      // 직접 입력 방식: DOM 캡처 → PDF 변환 → 병합 (가로 A4)
      await captureElementToPdfPage(finalMergedPdf, sectionEl, "l");
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


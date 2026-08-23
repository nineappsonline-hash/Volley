import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── CSV ────────────────────────────────────────────────────

/** Download a 2D array as a CSV file. */
export function downloadCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF helpers ────────────────────────────────────────────

export interface PDFDoc {
  doc: jsPDF;
  pageWidth: number;
}

/** Create a new landscape A4 PDF with a header. */
export function createPDF(title: string): PDFDoc {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Volley Academy", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 18);
  doc.text(
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    pageWidth - 14,
    12,
    { align: "right" }
  );
  doc.setDrawColor(200);
  doc.line(14, 21, pageWidth - 14, 21);

  return { doc, pageWidth };
}

/** Add a table to the PDF. Returns the Y position after the table. */
export function addPDFTable(
  pdf: PDFDoc,
  headers: string[],
  rows: string[][],
  startY: number = 28
): number {
  autoTable(pdf.doc, {
    head: [headers],
    body: rows,
    startY,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  // @ts-expect-error jspdf-autotable adds finalY to the doc
  return pdf.doc.lastAutoTable.finalY ?? startY + 10;
}

/** Download the PDF. */
export function downloadPDF(pdf: PDFDoc, filename: string) {
  pdf.doc.save(filename);
}

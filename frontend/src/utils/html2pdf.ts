import html2pdf from "html2pdf.js";

type Html2PdfInstance = {
  set: (options: Record<string, unknown>) => Html2PdfInstance;
  from: (element: HTMLElement) => Html2PdfInstance;
  save: () => Promise<void>;
};

const createHtml2Pdf = () => html2pdf() as unknown as Html2PdfInstance;

const waitForRender = (delay = 300) => new Promise((resolve) => window.setTimeout(resolve, delay));

const validateExportElement = (element: HTMLElement | null) => {
  if (!element) {
    throw new Error("PDF export target is missing.");
  }

  const styles = window.getComputedStyle(element);
  if (styles.display === "none" || styles.visibility === "hidden") {
    throw new Error("PDF export target must be visible before downloading.");
  }

  if (!element.innerHTML.trim()) {
    throw new Error("PDF export target is empty.");
  }
};

export const downloadElementAsPdf = async (element: HTMLElement, fileName: string) => {
  validateExportElement(element);
  await waitForRender(300);
  validateExportElement(element);

  await createHtml2Pdf()
    .set({
      filename: fileName,
      margin: [8, 8, 8, 8],
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: ["tr", ".avoid-break"],
      },
    })
    .from(element)
    .save();
};

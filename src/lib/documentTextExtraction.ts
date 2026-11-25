import { getDocumentFileType } from "./documentFiles";

const MAX_EXTRACTED_CHARACTERS = 50000;
const MAX_OCR_PAGES_PER_DOCUMENT = 20;
const MIN_PDF_TEXT_LENGTH = 24;
const OCR_RENDER_SCALE = 1.6;

export function canExtractDocumentText(fileName: string): boolean {
  const extension = getDocumentFileType(fileName)?.extension;
  return extension === ".pdf" || extension === ".png" || extension === ".jpg" || extension === ".jpeg" ||
    extension === ".webp" || extension === ".docx" || extension === ".xlsx" || extension === ".xls" ||
    extension === ".txt" || extension === ".csv";
}

export interface ExtractedDocumentText {
  text: string;
  warnings: string[];
}

export async function extractDocumentText(fileName: string, buffer: ArrayBuffer): Promise<ExtractedDocumentText> {
  const fileType = getDocumentFileType(fileName);
  if (!fileType) throw new Error("This file format is not supported for text analysis.");

  const warnings: string[] = [];
  let text = "";

  if (!canExtractDocumentText(fileName)) {
    throw new Error("Supported formats: PDF, images, DOCX, XLS/XLSX, TXT, and CSV.");
  }

  if (fileType.extension === ".pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerAsset = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerAsset.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pagesNeedingOcr: { pageNumber: number; page: Awaited<ReturnType<typeof pdf.getPage>> }[] = [];
    try {
      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => "str" in item ? item.str : "")
          .join(" ")
          .trim();
        pageTexts.push(pageText);
        if (pageText.length < MIN_PDF_TEXT_LENGTH) pagesNeedingOcr.push({ pageNumber, page });
      }

      const ocrPages = pagesNeedingOcr.slice(0, MAX_OCR_PAGES_PER_DOCUMENT);
      if (pagesNeedingOcr.length > ocrPages.length) {
        warnings.push(`OCR was limited to ${MAX_OCR_PAGES_PER_DOCUMENT} scanned pages in this PDF.`);
      }
      if (ocrPages.length) {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        try {
          for (const { pageNumber, page } of ocrPages) {
            const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d");
            if (!context) throw new Error("This browser cannot prepare a scanned PDF page for OCR.");
            await page.render({ canvasContext: context, viewport }).promise;
            const result = await worker.recognize(canvas);
            if (result.data.text.trim()) pageTexts[pageNumber - 1] = result.data.text.trim();
            canvas.width = 0;
            canvas.height = 0;
          }
        } finally {
          await worker.terminate();
        }
      }
      text = pageTexts.map((pageText, index) => `Page ${index + 1}\n${pageText}`).join("\n\n");
    } finally {
      await pdf.destroy();
    }
  } else if (fileType.extension === ".png" || fileType.extension === ".jpg" ||
    fileType.extension === ".jpeg" || fileType.extension === ".webp") {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(new Blob([buffer], { type: fileType.contentType }));
      text = result.data.text;
    } finally {
      await worker.terminate();
    }
  } else if (fileType.extension === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.default.extractRawText({ arrayBuffer: buffer });
    text = result.value;
    warnings.push(...result.messages
      .filter((message) => message.type === "warning")
      .map((message) => message.message)
      .slice(0, 3));
  } else if (fileType.extension === ".xlsx" || fileType.extension === ".xls") {
    const xlsx = await import("@e965/xlsx");
    const workbook = xlsx.read(buffer, { type: "array", sheetRows: 1001 });
    text = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      return sheet ? `Worksheet: ${name}\n${xlsx.utils.sheet_to_csv(sheet)}` : "";
    }).filter(Boolean).join("\n\n");
    warnings.push("Spreadsheet extraction is limited to the first 1,000 rows per worksheet.");
  } else if (fileType.extension === ".txt" || fileType.extension === ".csv") {
    text = new TextDecoder().decode(buffer);
  } else {
    throw new Error("This file format is not supported for text analysis. Supported formats: PDF, images, DOCX, XLS/XLSX, TXT, and CSV.");
  }

  if (text.length > MAX_EXTRACTED_CHARACTERS) {
    text = text.slice(0, MAX_EXTRACTED_CHARACTERS);
    warnings.push("Extracted text was shortened to 50,000 characters for analysis.");
  }
  if (!text.trim()) warnings.push("No readable text was found. The file may be blank, password-protected, or an unsupported scan.");
  return { text: text.trim(), warnings };
}

export interface DocumentKeyFindings {
  companyReferences: string[];
  roleDetails: string[];
  employmentDates: string[];
  salaryDetails: string[];
  otherTerms: string[];
}

export function identifyDocumentKeyFindings(text: string): DocumentKeyFindings {
  const lines = [...new Set(text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean))];
  const headerLines = lines.slice(0, 20);
  const datePattern = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{2,4})\b/i;
  const uniqueMatches = (predicate: (line: string) => boolean, limit = 10) =>
    lines.filter(predicate).slice(0, limit);

  return {
    companyReferences: uniqueMatches((line) => /\b(company|employer|organization|organisation|corporate|employed|employment|appointed|appointment|working at|working with|offer from|offer by)\b/i.test(line) ||
      (headerLines.includes(line) && /\b(?:Pvt\.?\s*Ltd\.?|Private Limited|Limited|Ltd\.?|LLP|Inc\.?|Corporation|Technologies|Technology|Solutions|Services|Industries|Enterprises|Consulting|Company|Bank|Group)\b/i.test(line))),
    roleDetails: uniqueMatches((line) => /\b(designation|job title|position|department|role|reporting to|reports to|engineer|analyst|manager|executive|developer|consultant|officer|associate|director|specialist|technician|accountant|supervisor)\b/i.test(line)),
    employmentDates: uniqueMatches((line) => datePattern.test(line) &&
      /\b(join(?:ing|ed)?|start(?:ing)?|commenc(?:e|ement)|appoint(?:ment|ed)?|employment|reliev(?:e|ing|ed)|terminat(?:ion|ed)|resign(?:ation|ed)?|effective|from|to|until|valid|issued|dated|date)\b/i.test(line)),
    salaryDetails: uniqueMatches((line) => /\b(salary|ctc|cost to company|compensation|remuneration|gross|net pay|basic pay|fixed pay|variable pay|allowance|per annum|p\.?\s*a\.?|monthly|annual package|inr|rs\.?)\b|₹/i.test(line) &&
      /\d/.test(line)),
    otherTerms: uniqueMatches((line) => /\b(probation|notice period|employee id|employee code|location|bonus|benefits|leave entitlement|annual leave|working hours)\b/i.test(line)),
  };
}

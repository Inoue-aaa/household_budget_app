import { extractOcrLines } from "@/lib/ocr/extract";
import type { OcrInputFile } from "@/lib/ocr/types";

export async function extractCreditScreenshotDraftLines(files: OcrInputFile[]) {
  return extractOcrLines({
    sourceType: "credit_screenshot",
    files
  });
}

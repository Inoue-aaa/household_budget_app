import { extractOcrLines } from "@/lib/ocr/extract";
import type { OcrInputFile } from "@/lib/ocr/types";

export async function extractReceiptDraftLines(files: OcrInputFile[]) {
  return extractOcrLines({
    sourceType: "receipt",
    files
  });
}

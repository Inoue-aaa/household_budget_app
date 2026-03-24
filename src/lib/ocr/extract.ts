import { createOcrProvider } from "@/lib/ocr/factory";
import type { OcrProvider } from "@/lib/ocr/provider";
import type { OcrInputFile, OcrUploadSourceType } from "@/lib/ocr/types";

export async function extractOcrLines(input: {
  sourceType: OcrUploadSourceType;
  files: OcrInputFile[];
  provider?: OcrProvider;
}) {
  const provider = input.provider ?? createOcrProvider();

  return provider.extract({
    sourceType: input.sourceType,
    files: input.files
  });
}

import { suggestCategoryIdForDraft } from "@/lib/classification/suggest";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import { extractOcrLines } from "@/lib/ocr/extract";
import {
  OcrProviderError,
  type OcrExtractionLine,
  type OcrInputFile,
  type OcrUploadSourceType
} from "@/lib/ocr/types";
import { listCategories } from "@/lib/finance/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOcrProviderMode } from "@/lib/utils/env";

const MAX_UPLOAD_FILES = 3;
const MAX_UPLOAD_FILE_SIZE = 8 * 1024 * 1024;
const UNSUPPORTED_IMAGE_TYPES = new Set(["image/heic", "image/heif"]);

export type UploadReviewErrorCode =
  | "unauthorized"
  | "missing-files"
  | "too-many-files"
  | "invalid-file"
  | "unsupported-heic"
  | "ocr-provider-unavailable"
  | "ocr-api-key-missing"
  | "ocr-request-failed"
  | "ocr-parse-failed"
  | "ocr-timeout"
  | "ocr-empty"
  | "create-error";

type UploadReviewSuccess = {
  ok: true;
  importGroupId: string;
};

type UploadReviewFailure = {
  ok: false;
  code: UploadReviewErrorCode;
};

export type UploadReviewResult = UploadReviewSuccess | UploadReviewFailure;

type UploadReviewConfig = {
  sourceType: OcrUploadSourceType;
  metadataOrigin: string;
  fallbackTitle: string;
};

function isUnsupportedHeicFile(file: File) {
  const loweredName = file.name.toLowerCase();
  const loweredType = file.type.toLowerCase();

  return (
    UNSUPPORTED_IMAGE_TYPES.has(loweredType) ||
    loweredName.endsWith(".heic") ||
    loweredName.endsWith(".heif")
  );
}

function parseUploadFiles(formData: FormData): File[] | UploadReviewFailure {
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return { ok: false, code: "missing-files" };
  }

  if (files.length > MAX_UPLOAD_FILES) {
    return { ok: false, code: "too-many-files" };
  }

  const invalidFile = files.find(
    (file) => !file.type.startsWith("image/") || file.size > MAX_UPLOAD_FILE_SIZE
  );

  if (invalidFile) {
    return { ok: false, code: "invalid-file" };
  }

  const unsupportedHeicFile = files.find(isUnsupportedHeicFile);

  if (unsupportedHeicFile) {
    return { ok: false, code: "unsupported-heic" };
  }

  return files;
}

async function toOcrInputFiles(files: File[]): Promise<OcrInputFile[]> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      bytes: new Uint8Array(await file.arrayBuffer())
    }))
  );
}

function deriveNeedsReview(input: {
  title: string;
  amount: number | null;
  categoryId: string | null;
}) {
  return !input.title.trim() || input.amount == null || input.amount <= 0 || !input.categoryId;
}

function deriveImportGroupDefaults(input: {
  files: File[];
  lines: OcrExtractionLine[];
  fallbackTitle: string;
}) {
  const occurredOn =
    input.lines.find((line) => line.occurredOn)?.occurredOn ?? new Date().toISOString().slice(0, 10);
  const merchantName = input.lines.find((line) => line.merchantName)?.merchantName ?? null;
  const title = merchantName ?? input.files[0]?.name.replace(/\.[^.]+$/, "") ?? input.fallbackTitle;

  return {
    occurredOn,
    merchantName,
    title
  };
}

async function buildDraftRows(input: {
  userId: string;
  accountId: string;
  importGroupId: string;
  files: File[];
  sourceType: OcrUploadSourceType;
  occurredOn: string;
  merchantName: string | null;
  lines: OcrExtractionLine[];
  categories: Awaited<ReturnType<typeof listCategories>>;
}) {
  return Promise.all(
    input.lines.map(async (line, index) => {
      const merchantName = line.merchantName ?? input.merchantName;
      const suggestion = await suggestCategoryIdForDraft(
        {
          title: line.title,
          merchantName
        },
        input.categories
      );

      return {
        user_id: input.userId,
        account_id: input.accountId,
        import_group_id: input.importGroupId,
        line_index: line.lineIndex ?? index,
        occurred_on: line.occurredOn ?? input.occurredOn,
        merchant_name: merchantName,
        title: line.title,
        amount: line.amount,
        suggested_category_id: suggestion.categoryId,
        note: null,
        source_type: input.sourceType,
        needs_review:
          suggestion.needsReview ||
          deriveNeedsReview({
            title: line.title,
            amount: line.amount,
            categoryId: suggestion.categoryId
          }),
        raw_payload: {
          providerPayload: line.rawPayload ?? null,
          rawText: line.rawText ?? null,
          fileNames: input.files.map((file) => file.name)
        }
      };
    })
  );
}

function mapOcrErrorCode(error: OcrProviderError): UploadReviewErrorCode {
  switch (error.code) {
    case "provider-unavailable":
      return "ocr-provider-unavailable";
    case "api-key-missing":
      return "ocr-api-key-missing";
    case "parse-failed":
      return "ocr-parse-failed";
    case "timeout":
      return "ocr-timeout";
    case "request-failed":
    default:
      return "ocr-request-failed";
  }
}

export async function createUploadReviewDrafts(
  formData: FormData,
  config: UploadReviewConfig
): Promise<UploadReviewResult> {
  const parsedFiles = parseUploadFiles(formData);

  if (!Array.isArray(parsedFiles)) {
    return parsedFiles;
  }

  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return { ok: false, code: "unauthorized" };
  }

  const [ocrFiles, categories] = await Promise.all([
    toOcrInputFiles(parsedFiles),
    listCategories()
  ]);

  let ocrResult;
  const requestedProviderMode = getOcrProviderMode();

  try {
    ocrResult = await extractOcrLines({
      sourceType: config.sourceType,
      files: ocrFiles
    });
    console.info("[ocr] extract success", {
      sourceType: config.sourceType,
      requestedProviderMode,
      providerMode: ocrResult.providerMode,
      providerName: ocrResult.providerName,
      fallbackUsed: ocrResult.fallbackUsed,
      lineCount: ocrResult.lines.length
    });
  } catch (error) {
    if (error instanceof OcrProviderError) {
      console.error("[ocr] extract failed", {
        sourceType: config.sourceType,
        requestedProviderMode,
        errorCode: error.code,
        message: error.message
      });
      return { ok: false, code: mapOcrErrorCode(error) };
    }

    console.error("[ocr] extract failed", {
      sourceType: config.sourceType,
      requestedProviderMode,
      errorCode: "ocr-request-failed"
    });
    return { ok: false, code: "ocr-request-failed" };
  }

  if (ocrResult.lines.length === 0) {
    console.warn("[ocr] extract empty", {
      sourceType: config.sourceType,
      requestedProviderMode,
      providerMode: ocrResult.providerMode,
      providerName: ocrResult.providerName
    });
    return { ok: false, code: "ocr-empty" };
  }

  const defaults = deriveImportGroupDefaults({
    files: parsedFiles,
    lines: ocrResult.lines,
    fallbackTitle: config.fallbackTitle
  });

  const { data: importGroup, error: importGroupError } = await supabase
    .from("import_groups")
    .insert({
      user_id: accountContext.userId,
      account_id: accountContext.currentAccount.id,
      source_type: config.sourceType,
      status: "draft",
      title: defaults.title,
      occurred_on: defaults.occurredOn,
      metadata: {
        origin: config.metadataOrigin,
        fileCount: parsedFiles.length,
        fileNames: parsedFiles.map((file) => file.name),
        ocr: {
          requestedProviderMode,
          providerMode: ocrResult.providerMode,
          providerName: ocrResult.providerName,
          fallbackUsed: ocrResult.fallbackUsed,
          lineCount: ocrResult.lines.length,
          errorCode: null
        }
      }
    })
    .select("id")
    .single();

  if (importGroupError || !importGroup) {
    return { ok: false, code: "create-error" };
  }

  const draftRows = await buildDraftRows({
    userId: accountContext.userId,
    accountId: accountContext.currentAccount.id,
    importGroupId: importGroup.id,
    files: parsedFiles,
    sourceType: config.sourceType,
    occurredOn: defaults.occurredOn,
    merchantName: defaults.merchantName,
    lines: ocrResult.lines,
    categories
  });

  const { error: draftError } = await supabase.from("expense_drafts").insert(draftRows);

  if (draftError) {
    await supabase.from("import_groups").delete().eq("id", importGroup.id);
    return { ok: false, code: "create-error" };
  }

  return {
    ok: true,
    importGroupId: importGroup.id
  };
}

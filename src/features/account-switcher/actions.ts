"use server";

import { z } from "zod";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertUserPreferencesPatch } from "@/lib/preferences/queries";

export type SwitchAccountActionResult =
  | {
      status: "success";
      accountId: string;
    }
  | {
      status: "error" | "unauthorized";
      message: string;
    };

const switchAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export async function switchCurrentAccountAction(
  formData: FormData
): Promise<SwitchAccountActionResult> {
  const parsed = switchAccountSchema.safeParse({
    accountId: formData.get("accountId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "利用アカウントを切り替えられませんでした。"
    };
  }

  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return {
      status: "unauthorized",
      message: "ログイン状態を確認できませんでした。"
    };
  }

  const targetAccount = accountContext.accounts.find(
    (account) => account.id === parsed.data.accountId
  );

  if (!targetAccount) {
    return {
      status: "error",
      message: "利用アカウントを切り替えられませんでした。"
    };
  }

  try {
    await upsertUserPreferencesPatch(supabase, accountContext.userId, {
      currentAccountId: targetAccount.id,
    });
  } catch {
    return {
      status: "error",
      message: "利用アカウントを切り替えられませんでした。"
    };
  }

  return {
    status: "success",
    accountId: targetAccount.id
  };
}

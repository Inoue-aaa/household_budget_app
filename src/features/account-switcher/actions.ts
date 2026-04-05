"use server";

import { z } from "zod";
import { setCurrentAccountCookieValue } from "@/lib/accounts/cookies";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";

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
    await setCurrentAccountCookieValue(targetAccount.id);
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

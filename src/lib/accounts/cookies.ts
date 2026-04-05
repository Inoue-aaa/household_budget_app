import { cookies } from "next/headers";

export const CURRENT_ACCOUNT_COOKIE_NAME = "hb_current_account_id";

const CURRENT_ACCOUNT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function getCurrentAccountCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(CURRENT_ACCOUNT_COOKIE_NAME)?.value ?? null;
}

export async function setCurrentAccountCookieValue(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_ACCOUNT_COOKIE_NAME, accountId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: CURRENT_ACCOUNT_COOKIE_MAX_AGE_SECONDS
  });
}

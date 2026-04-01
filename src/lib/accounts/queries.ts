import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_HOUSEHOLD_ACCOUNT_SLUG,
  FIXED_HOUSEHOLD_ACCOUNT_SEEDS,
} from "@/lib/accounts/constants";
import type { HouseholdAccountRow, UserPreferenceRow } from "@/lib/finance/db-types";
import type { CurrentAccountSnapshot, HouseholdAccountOption } from "@/lib/finance/types";
import { DEFAULT_THEME_NAME, isAppThemeName, type AppThemeName } from "@/lib/theme/themes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PreferencesPatch = {
  themeName?: AppThemeName;
  currentAccountId?: string | null;
};

type AuthenticatedAccountContext = {
  userId: string;
  currentAccount: HouseholdAccountOption;
  accounts: HouseholdAccountOption[];
};

function mapAccountRow(row: HouseholdAccountRow): HouseholdAccountOption {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    colorKey: row.color_key,
    sortOrder: row.sort_order,
  };
}

async function ensureHouseholdAccounts(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdAccountOption[]> {
  const { error: upsertError } = await supabase.from("household_accounts").upsert(
    FIXED_HOUSEHOLD_ACCOUNT_SEEDS.map((account) => ({
      user_id: userId,
      slug: account.slug,
      name: account.name,
      color_key: account.colorKey,
      sort_order: account.sortOrder,
    })),
    {
      onConflict: "user_id,slug",
    }
  );

  if (upsertError) {
    throw upsertError;
  }

  const { data, error } = await supabase
    .from("household_accounts")
    .select("id, user_id, slug, name, color_key, sort_order, created_at, updated_at")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    throw error ?? new Error("Failed to load household accounts");
  }

  return data.map(mapAccountRow);
}

async function getUserPreferencesRecord(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferenceRow | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("id, user_id, theme_name, current_account_id, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function upsertUserPreferencesPatch(
  supabase: SupabaseClient,
  userId: string,
  patch: PreferencesPatch
) {
  const existing = await getUserPreferencesRecord(supabase, userId);

  const themeName =
    patch.themeName ??
    (existing?.theme_name && isAppThemeName(existing.theme_name)
      ? existing.theme_name
      : DEFAULT_THEME_NAME);

  const currentAccountId =
    patch.currentAccountId !== undefined
      ? patch.currentAccountId
      : existing?.current_account_id ?? null;

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      theme_name: themeName,
      current_account_id: currentAccountId,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw error;
  }
}

const getCurrentAccountSnapshotInternal = cache(async (): Promise<CurrentAccountSnapshot | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const accounts = await ensureHouseholdAccounts(supabase, user.id);
  const preferences = await getUserPreferencesRecord(supabase, user.id);
  const currentAccount =
    accounts.find((account) => account.id === preferences?.current_account_id) ??
    accounts.find((account) => account.slug === DEFAULT_HOUSEHOLD_ACCOUNT_SLUG) ??
    accounts[0];

  if (!preferences || preferences.current_account_id !== currentAccount.id) {
    await upsertUserPreferencesPatch(supabase, user.id, {
      currentAccountId: currentAccount.id,
    });
  }

  return {
    currentAccount,
    accounts,
  };
});

const getAuthenticatedAccountContextInternal = cache(
  async (): Promise<AuthenticatedAccountContext | null> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const accounts = await ensureHouseholdAccounts(supabase, user.id);
    const preferences = await getUserPreferencesRecord(supabase, user.id);
    const currentAccount =
      accounts.find((account) => account.id === preferences?.current_account_id) ??
      accounts.find((account) => account.slug === DEFAULT_HOUSEHOLD_ACCOUNT_SLUG) ??
      accounts[0];

    if (!preferences || preferences.current_account_id !== currentAccount.id) {
      await upsertUserPreferencesPatch(supabase, user.id, {
        currentAccountId: currentAccount.id,
      });
    }

    return {
      userId: user.id,
      currentAccount,
      accounts,
    };
  }
);

export async function getCurrentAccountSnapshot(): Promise<CurrentAccountSnapshot | null> {
  return getCurrentAccountSnapshotInternal();
}

export async function getAuthenticatedAccountContext(): Promise<AuthenticatedAccountContext | null> {
  return getAuthenticatedAccountContextInternal();
}

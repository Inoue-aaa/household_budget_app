"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  switchCurrentAccountAction,
  type SwitchAccountActionResult,
} from "@/features/account-switcher/actions";
import type { HouseholdAccountOption } from "@/lib/finance/types";

type AccountSwitcherFormProps = {
  accounts: HouseholdAccountOption[];
  currentAccountId: string;
};

function getAccountIconClass(colorKey: HouseholdAccountOption["colorKey"]) {
  switch (colorKey) {
    case "pink":
      return "account-avatar account-avatar-pink";
    case "blend":
      return "account-avatar account-avatar-blend";
    case "blue":
    default:
      return "account-avatar account-avatar-blue";
  }
}

export function AccountSwitcherForm({
  accounts,
  currentAccountId,
}: AccountSwitcherFormProps) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState(currentAccountId);
  const [result, setResult] = useState<SwitchAccountActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedAccountId(currentAccountId);
  }, [currentAccountId]);

  return (
    <div className="field-stack">
      <div className="account-switcher-grid">
        {accounts.map((account) => {
          const isActive = account.id === selectedAccountId;

          return (
            <button
              className="account-switcher-button"
              data-active={isActive}
              disabled={isPending}
              key={account.id}
              onClick={() => {
                if (account.id === selectedAccountId) {
                  return;
                }

                setResult(null);
                setSelectedAccountId(account.id);

                startTransition(async () => {
                  const formData = new FormData();
                  formData.set("accountId", account.id);
                  const actionResult = await switchCurrentAccountAction(formData);

                  if (actionResult.status === "unauthorized") {
                    router.push("/login");
                    return;
                  }

                  if (actionResult.status === "error") {
                    setSelectedAccountId(currentAccountId);
                    setResult(actionResult);
                    return;
                  }

                  setResult(actionResult);
                  router.refresh();
                });
              }}
              type="button"
            >
              <span className="account-avatar-shell">
                <span className={getAccountIconClass(account.colorKey)} aria-hidden="true">
                  <span className="account-avatar-head" />
                  <span className="account-avatar-body" />
                </span>
                {isActive ? <span className="account-avatar-check">✓</span> : null}
              </span>
              <span className="account-switcher-name">{account.name}</span>
            </button>
          );
        })}
      </div>

      {result?.status === "error" ? (
        <p className="form-message form-message-error">{result.message}</p>
      ) : null}
    </div>
  );
}

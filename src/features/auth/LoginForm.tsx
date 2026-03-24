"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { requestMagicLinkAction } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/form-state";

export function LoginForm() {
  const [state, formAction] = useActionState(requestMagicLinkAction, initialAuthFormState);

  return (
    <form action={formAction} className="field-stack">
      <div className="field">
        <label htmlFor="email">メールアドレス</label>
        <input
          autoComplete="email"
          defaultValue=""
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <p className="field-hint">Supabase Auth の Magic Link を利用します。</p>
      </div>

      {state.status === "error" ? <p className="error-text">{state.message}</p> : null}
      {state.status === "success" ? <p className="success-text">{state.message}</p> : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="送信中...">ログインリンクを送信</SubmitButton>
        <p className="caption">本人専用アプリのため、新規登録画面は設けず許可メールのみ受け付けます。</p>
      </div>
    </form>
  );
}

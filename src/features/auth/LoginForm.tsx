"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { signInWithPasswordAction } from "@/features/auth/actions";
import { initialLoginFormState } from "@/features/auth/form-state";

type LoginFormProps = {
  defaultEmail?: string;
};

export function LoginForm({ defaultEmail = "" }: LoginFormProps) {
  const [state, formAction] = useActionState(
    signInWithPasswordAction,
    initialLoginFormState,
  );

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
        <p className="field-hint">
          ご自身のメールアドレスでログインします。自分専用の家計簿として使う前提です。
        </p>
      </div>

      <div className="field">
        <label htmlFor="password">パスワード</label>
        <input
          autoComplete="current-password"
          defaultValue=""
          id="password"
          name="password"
          placeholder="8文字以上"
          required
          type="password"
        />
        <p className="field-hint">
          iPhone の保存済みパスワードを使うと次回以降の入力が楽になります。
        </p>
        {state.fieldErrors?.password ? (
          <p className="error-text">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p className="error-text">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="success-text">{state.message}</p>
      ) : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="ログイン中...">ログイン</SubmitButton>
        <p className="caption">
          初回のパスワード設定がまだの場合は{" "}
          <Link href="/signup">アカウント作成</Link> から進めてください。
        </p>
      </div>
    </form>
  );
}

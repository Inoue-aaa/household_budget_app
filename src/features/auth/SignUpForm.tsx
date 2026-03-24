"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { signUpWithPasswordAction } from "@/features/auth/actions";
import { initialSignUpFormState } from "@/features/auth/form-state";

type SignUpFormProps = {
  defaultEmail?: string;
};

export function SignUpForm({ defaultEmail = "" }: SignUpFormProps) {
  const [state, formAction] = useActionState(signUpWithPasswordAction, {
    ...initialSignUpFormState,
    values: {
      ...initialSignUpFormState.values,
      email: defaultEmail
    }
  });

  return (
    <form action={formAction} className="field-stack">
      <div className="field">
        <label htmlFor="email">メールアドレス</label>
        <input
          autoComplete="email"
          defaultValue={state.values.email}
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <p className="field-hint">このアプリで使うメールアドレスとパスワードを最初に登録します。</p>
        {state.fieldErrors?.email ? <p className="error-text">{state.fieldErrors.email}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="password">パスワード</label>
        <input
          autoComplete="new-password"
          defaultValue=""
          id="password"
          name="password"
          placeholder="8文字以上"
          required
          type="password"
        />
        <p className="field-hint">8文字以上で設定してください。あとから Supabase Auth 側で再設定もできます。</p>
        {state.fieldErrors?.password ? (
          <p className="error-text">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="passwordConfirm">パスワード確認</label>
        <input
          autoComplete="new-password"
          defaultValue=""
          id="passwordConfirm"
          name="passwordConfirm"
          placeholder="もう一度入力"
          required
          type="password"
        />
        {state.fieldErrors?.passwordConfirm ? (
          <p className="error-text">{state.fieldErrors.passwordConfirm}</p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? <p className="error-text">{state.message}</p> : null}
      {state.status === "success" && state.message ? (
        <p className="success-text">{state.message}</p>
      ) : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="作成中...">アカウントを作成</SubmitButton>
        <p className="caption">
          すでに登録済みの場合は <Link href="/login">ログイン</Link> へ戻ってください。
        </p>
      </div>
    </form>
  );
}

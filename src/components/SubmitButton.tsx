"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  testId?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "保存中...",
  className = "button",
  testId
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} data-testid={testId} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}

"use client";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  confirmationMessage: string;
  className?: string;
  testId?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
};

export function ConfirmSubmitButton({
  children,
  confirmationMessage,
  className = "button button-secondary",
  testId,
  formAction
}: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      data-testid={testId}
      formAction={formAction}
      onClick={(event) => {
        if (!window.confirm(confirmationMessage)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {children}
    </button>
  );
}

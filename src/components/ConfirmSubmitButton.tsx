"use client";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  confirmationMessage: string;
  className?: string;
  testId?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmationMessage,
  className = "button button-secondary",
  testId
}: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      data-testid={testId}
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

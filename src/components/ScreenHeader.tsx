import type { ReactNode } from "react";

type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: ScreenHeaderProps) {
  return (
    <header className="surface screen-header">
      <div className="screen-header-top">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="screen-title">{title}</h1>
        </div>
        {action ? <div className="screen-header-action">{action}</div> : null}
      </div>
      <div className="screen-description">{description}</div>
    </header>
  );
}

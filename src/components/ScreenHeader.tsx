import type { ReactNode } from "react";

type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
};

export function ScreenHeader({ eyebrow, title, description }: ScreenHeaderProps) {
  return (
    <header className="surface screen-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="screen-title">{title}</h1>
      <div className="screen-description">{description}</div>
    </header>
  );
}

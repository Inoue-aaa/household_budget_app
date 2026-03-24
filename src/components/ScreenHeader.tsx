type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ScreenHeader({ eyebrow, title, description }: ScreenHeaderProps) {
  return (
    <header className="surface screen-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="screen-title">{title}</h1>
      <p className="screen-description">{description}</p>
    </header>
  );
}

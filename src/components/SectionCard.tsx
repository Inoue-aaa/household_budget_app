type SectionCardProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="surface section-card">
      <h2 className="section-title">{title}</h2>
      {description ? <p className="section-copy">{description}</p> : null}
      {children ? <div style={{ height: 16 }} /> : null}
      {children}
    </section>
  );
}

type NoticeBannerProps = {
  tone?: "info" | "success";
  title: string;
  description?: string;
};

export function NoticeBanner({
  tone = "info",
  title,
  description
}: NoticeBannerProps) {
  return (
    <section className={`notice-banner notice-${tone}`}>
      <p className="notice-title">{title}</p>
      {description ? <p className="notice-description">{description}</p> : null}
    </section>
  );
}

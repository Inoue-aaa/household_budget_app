export default function ExpensesLoading() {
  return (
    <div className="page-stack">
      <div className="surface screen-header">
        <div className="loading-line loading-line-eyebrow" />
        <div className="loading-line loading-line-title" />
        <div className="loading-line loading-line-copy" />
      </div>

      <div className="surface loading-card-block">
        <div className="loading-line loading-line-section" />
        <div className="loading-line loading-line-short" />
        <div className="loading-bar" />
      </div>

      <div className="surface loading-card-block">
        <div className="loading-line loading-line-section" />
        <div className="loading-grid">
          <div className="loading-stat" />
          <div className="loading-stat" />
        </div>
      </div>
    </div>
  );
}

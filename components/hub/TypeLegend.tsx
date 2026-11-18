const CARDS = [
  {
    type: "Analysis",
    desc: "Long-form, data-backed analytical pieces",
    badgeClass: "ih-badge ih-badge-dark",
  },
  {
    type: "Signal",
    desc: "Short, dated developments — straight from our tracking engine, or flagged by our analysts",
    badgeClass: "ih-badge ih-badge-dark",
  },
  {
    type: "Report · PDF",
    desc: "Downloadable PDFs — citable, quarterly research documents",
    badgeClass: "ih-badge ih-badge-report",
  },
  {
    type: "News",
    desc: "Curated external coverage with context and commentary added",
    badgeClass: "ih-badge ih-badge-news",
  },
] as const;

export function TypeLegend() {
  return (
    <div className="ih-legend">
      {CARDS.map((c) => (
        <div key={c.type} className="ih-legend-card">
          <span className={c.badgeClass}>{c.type}</span>
          <p className="ih-legend-desc">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}

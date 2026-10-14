interface CommonReviewThemesProps {
  themes: string[];
}

export function CommonReviewThemes({ themes }: CommonReviewThemesProps) {
  return (
    <section className="details-section" aria-labelledby="themes-heading">
      <h2 id="themes-heading">Common Review Themes</h2>
      {themes.length > 0 ? (
        <div className="themes" aria-label="Recurring review themes">
          {themes.map((theme) => <span key={theme}>{theme}</span>)}
        </div>
      ) : (
        <p className="empty-state">Not enough matching review information is available to identify recurring themes.</p>
      )}
      <p className="demo-disclosure">Themes appear only when the same mock review tag occurs in at least two reviews.</p>
    </section>
  );
}

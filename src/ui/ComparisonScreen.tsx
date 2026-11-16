import { formatRating, ratingScaleMax, type CourseOffering, type Professor } from "../models/professor";
import { ArrowLeftIcon } from "./Icons";

interface ComparisonScreenProps {
  course: CourseOffering;
  professors: Professor[];
  onBack: () => void;
}

interface Metric {
  label: string;
  hint: string;
  read: (professor: Professor) => number;
}

/**
 * Only the three scores PolyRatings actually publishes. "Recognizes struggles"
 * is deliberately not labelled "difficulty": a high value means the professor
 * noticed when students were stuck, which is the opposite of a hard course.
 */
const metrics: ReadonlyArray<Metric> = [
  { label: "Overall", hint: "PolyRatings overall rating", read: (professor) => professor.starRating },
  { label: "Presents clearly", hint: "Presents material clearly", read: (professor) => professor.clarityRating },
  { label: "Recognizes struggles", hint: "Recognizes student difficulties", read: (professor) => professor.supportRating },
];

export function ComparisonScreen({ course, professors, onBack }: ComparisonScreenProps) {
  const ranked = [...professors].sort((left, right) => right.starRating - left.starRating);
  // A leader is only meaningful with something to lead.
  const leaders = new Map(
    metrics.map((metric) => [
      metric.label,
      ranked.length >= 2 ? Math.max(...ranked.map(metric.read)) : null,
    ]),
  );

  return (
    <div className="screen">
      <div className="scroll-area">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          Back to results
        </button>

        <div className="section-head">
          <h1 className="course-heading">Compare • {course.code}</h1>
          <span className="section-count">
            {ranked.length} {ranked.length === 1 ? "professor" : "professors"}
          </span>
        </div>

        {ranked.length === 0 ? (
          <p className="empty-state">No professor information is available for this class yet.</p>
        ) : (
          <div className="card-list">
            {ranked.map((professor) => (
              <section className="compare-card" key={professor.id} aria-label={`Comparison for ${professor.name}`}>
                <div className="compare-head">
                  <h2 className="card-title">{professor.name}</h2>
                  <span className="reviews-total">{professor.reviewCount} reviews</span>
                </div>
                <hr className="card-divider" />
                {metrics.map((metric) => {
                  const value = metric.read(professor);
                  const isLeader = leaders.get(metric.label) === value;
                  return (
                    <div className="metric" key={metric.label}>
                      <span className="metric-label" title={metric.hint}>{metric.label}</span>
                      <span className="metric-bar" aria-hidden="true">
                        <span className="metric-fill" style={{ width: `${(value / ratingScaleMax) * 100}%` }} />
                      </span>
                      <span
                        className={isLeader ? "metric-value is-leader" : "metric-value"}
                        aria-label={`${metric.hint}: ${formatRating(value)} out of ${ratingScaleMax}`}
                      >
                        {formatRating(value)}
                      </span>
                    </div>
                  );
                })}
                {professor.tags.length > 0 ? (
                  <div className="theme-list compare-tags">
                    {professor.tags.slice(0, 3).map((tag) => (
                      <span className="theme-chip theme-mixed" key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        )}

        <p className="synthesis-note">
          All scores are PolyRatings values out of {ratingScaleMax}. "Recognizes struggles" is how well students
          felt the professor noticed when they were stuck, not how hard the course is.
        </p>
      </div>
    </div>
  );
}

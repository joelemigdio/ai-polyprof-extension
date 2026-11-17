import type { FavoriteClass } from "../models/favorites";
import { SparkleIcon, StarIcon } from "./Icons";

interface DashboardScreenProps {
  favorites: FavoriteClass[];
  onOpenFavorites: () => void;
}

function savedDetail(favorite: FavoriteClass): string {
  const section = favorite.kind === "section" && favorite.sectionLabel
    ? `Section ${favorite.sectionLabel}`
    : favorite.courseTitle ?? "Saved course";
  return favorite.professorName ? `${section} • ${favorite.professorName}` : section;
}

/** The popup is a companion to Student Center, not a second course catalog. */
export function DashboardScreen({ favorites, onOpenFavorites }: DashboardScreenProps) {
  const preview = favorites.slice(0, 3);

  return (
    <div className="screen">
      <div className="scroll-area dashboard-scroll">
        <section className="dashboard-intro" aria-labelledby="dashboard-heading">
          <span className="dashboard-kicker"><SparkleIcon size={15} /> Student Center companion</span>
          <h1 id="dashboard-heading">Compare professors where you register.</h1>
          <p>
            Open a class in Student Center, then select a professor to view ratings, compare instructors, and save the exact section you want.
          </p>
        </section>

        <section className="dashboard-favorites" aria-labelledby="dashboard-favorites-heading">
          <div className="section-head">
            <p className="section-label" id="dashboard-favorites-heading">Saved classes &amp; sections</p>
            <button className="link-button" type="button" onClick={onOpenFavorites}>
              {favorites.length === 0 ? "Open favorites" : "View all"}
            </button>
          </div>

          {preview.length === 0 ? (
            <div className="dashboard-empty">
              <StarIcon size={19} />
              <p>No saved classes or sections yet.</p>
              <span>Use the star on a Student Center professor card to keep an option here.</span>
            </div>
          ) : (
            <div className="dashboard-favorite-list">
              {preview.map((favorite) => (
                <button
                  className="dashboard-favorite"
                  key={favorite.id}
                  type="button"
                  onClick={onOpenFavorites}
                  aria-label={`Open favorites: ${favorite.courseCode}, ${savedDetail(favorite)}`}
                >
                  <StarIcon size={17} />
                  <span>
                    <strong>{favorite.courseCode}</strong>
                    <small>{savedDetail(favorite)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

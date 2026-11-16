import { formatRating, ratingScaleMax } from "../models/professor";
import type { FavoriteClass } from "../models/favorites";
import { PeerIcon, StarIcon } from "./Icons";

interface FavoritesScreenProps {
  favorites: FavoriteClass[];
  onRemove: (id: string) => void;
  onOpenCourse: (courseCode: string) => void;
  onBrowse: () => void;
}

function savedLabel(savedAt: string): string {
  const parsed = Date.parse(savedAt);
  if (Number.isNaN(parsed) || parsed === 0) return "Saved";
  return `Saved ${new Date(parsed).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function FavoritesScreen({ favorites, onRemove, onOpenCourse, onBrowse }: FavoritesScreenProps) {
  return (
    <div className="screen">
      <div className="scroll-area">
        <div className="section-head">
          <p className="section-label">Favorited classes</p>
          <span className="section-count">
            {favorites.length} {favorites.length === 1 ? "saved" : "saved"}
          </span>
        </div>

        {favorites.length === 0 ? (
          <div className="empty-block">
            <p className="empty-state">
              You have not saved any classes yet. Tap the star on a class to keep it here while you compare options.
            </p>
            <button className="link-button" type="button" onClick={onBrowse}>
              Browse classes
            </button>
          </div>
        ) : (
          <div className="card-list">
            {favorites.map((favorite) => (
              <div className="entity-card-wrap" key={favorite.id}>
                <button
                  className="entity-card"
                  type="button"
                  onClick={() => onOpenCourse(favorite.courseCode)}
                >
                  <div className="card-top">
                    <div className="card-identity">
                      <h2 className="card-title">{favorite.courseCode}</h2>
                      <p className="card-subtitle">
                        {[favorite.courseTitle, favorite.professorName].filter(Boolean).join(" • ") ||
                          "Saved from the Student Center"}
                      </p>
                    </div>
                    {favorite.starRating !== null ? (
                      <div className="pills">
                        <span
                          className="pill pill-star"
                          aria-label={`Overall rating ${formatRating(favorite.starRating)} out of ${ratingScaleMax}`}
                        >
                          <StarIcon size={15} />
                          {formatRating(favorite.starRating)}
                        </span>
                        {favorite.clarityRating !== null ? (
                          <span
                            className="pill pill-peer"
                            aria-label={`Presents material clearly ${formatRating(favorite.clarityRating)} out of ${ratingScaleMax}`}
                          >
                            <PeerIcon size={15} />
                            {formatRating(favorite.clarityRating)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <hr className="card-divider" />
                  <p className="fit-line">{savedLabel(favorite.savedAt)}</p>
                </button>
                <button
                  className="favorite-toggle is-favorite"
                  type="button"
                  onClick={() => onRemove(favorite.id)}
                  aria-label={`Remove ${favorite.courseCode} from favorites`}
                >
                  <StarIcon size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { ArrowLeftIcon, GearIcon, StarIcon } from "./Icons";

interface AppHeaderProps {
  isPreferencesOpen: boolean;
  isFavoritesOpen: boolean;
  favoritesCount: number;
  onToggle: () => void;
  onToggleFavorites: () => void;
}

export function AppHeader({
  isPreferencesOpen,
  isFavoritesOpen,
  favoritesCount,
  onToggle,
  onToggleFavorites,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <p className="wordmark">PolyProf</p>
      <div className="header-actions">
        <button
          className={isFavoritesOpen ? "header-button is-active" : "header-button"}
          type="button"
          onClick={onToggleFavorites}
          aria-pressed={isFavoritesOpen}
          aria-label={
            isFavoritesOpen
              ? "Close favorites"
              : `Open favorites, ${favoritesCount} saved ${favoritesCount === 1 ? "class" : "classes"}`
          }
        >
          {isFavoritesOpen ? <ArrowLeftIcon size={17} /> : <StarIcon size={17} />}
          {!isFavoritesOpen && favoritesCount > 0 ? (
            <span className="header-badge" aria-hidden="true">{favoritesCount}</span>
          ) : null}
        </button>
        <button
          className="header-button"
          type="button"
          onClick={onToggle}
          aria-label={isPreferencesOpen ? "Close preferences" : "Open preferences"}
        >
          {isPreferencesOpen ? <ArrowLeftIcon size={17} /> : <GearIcon size={17} />}
        </button>
      </div>
    </header>
  );
}

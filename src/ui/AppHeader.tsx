import { ArrowLeftIcon, GearIcon } from "./Icons";

interface AppHeaderProps {
  isPreferencesOpen: boolean;
  onToggle: () => void;
}

export function AppHeader({ isPreferencesOpen, onToggle }: AppHeaderProps) {
  return (
    <header className="app-header">
      <p className="wordmark">PolyProf</p>
      <button
        className="header-button"
        type="button"
        onClick={onToggle}
        aria-label={isPreferencesOpen ? "Close preferences" : "Open preferences"}
      >
        {isPreferencesOpen ? <ArrowLeftIcon size={17} /> : <GearIcon size={17} />}
      </button>
    </header>
  );
}

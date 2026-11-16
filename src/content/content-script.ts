import { polyratingsDataService } from "../services/polyratings-data-service";
import { addFavorite, loadFavorites, normalizeFavorites, removeFavorite } from "../services/favorites-storage";
import { loadPreferences, normalizePreferences } from "../services/preference-storage";
import { DevelopmentDiagnostics, ENABLE_DEVELOPMENT_DIAGNOSTICS } from "./development-diagnostics";
import { renderSourceUnavailableNotice } from "./source-unavailable-notice";
import { StudentCenterIntegration } from "./student-center-integration";

async function bootstrap(): Promise<void> {
  const diagnostics = ENABLE_DEVELOPMENT_DIAGNOSTICS ? new DevelopmentDiagnostics(document) : undefined;
  try {
    const [professors, preferences, favorites] = await Promise.all([
      polyratingsDataService.getProfessorResults(),
      loadPreferences(),
      loadFavorites().catch(() => []),
    ]);

    const integration = new StudentCenterIntegration({
      document,
      professors,
      details: polyratingsDataService,
      preferences,
      favorites,
      onToggleFavorite: (favorite, isSaved) => {
        void (isSaved ? addFavorite(favorite) : removeFavorite(favorite.id));
      },
      diagnostics,
    });
    integration.start();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.studentPreferences) {
        integration.updatePreferences(normalizePreferences(changes.studentPreferences.newValue));
      }
      if (changes.favoriteClasses) {
        integration.updateFavorites(normalizeFavorites(changes.favoriteClasses.newValue));
      }
    });
  } catch (error) {
    diagnostics?.renderingError();
    // Diagnostics are compiled out of shipped builds, so without this the page
    // would look identical to one where the extension simply did nothing.
    renderSourceUnavailableNotice(document, error);
  }
}

void bootstrap();

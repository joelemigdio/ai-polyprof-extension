import { polyratingsDataService } from "../services/polyratings-data-service";
import { loadPreferences, normalizePreferences } from "../services/preference-storage";
import { DevelopmentDiagnostics, ENABLE_DEVELOPMENT_DIAGNOSTICS } from "./development-diagnostics";
import { StudentCenterIntegration } from "./student-center-integration";

async function bootstrap(): Promise<void> {
  const diagnostics = ENABLE_DEVELOPMENT_DIAGNOSTICS ? new DevelopmentDiagnostics(document) : undefined;
  try {
    const [professors, preferences] = await Promise.all([
      polyratingsDataService.getProfessorResults(),
      loadPreferences(),
    ]);

    const integration = new StudentCenterIntegration({
      document,
      professors,
      details: polyratingsDataService,
      preferences,
      diagnostics,
    });
    integration.start();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.studentPreferences) return;
      integration.updatePreferences(normalizePreferences(changes.studentPreferences.newValue));
    });
  } catch {
    diagnostics?.renderingError();
  }
}

void bootstrap();

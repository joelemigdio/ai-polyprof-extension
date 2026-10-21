import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { loadPreferences, normalizePreferences } from "../services/preference-storage";
import { DevelopmentDiagnostics, ENABLE_DEVELOPMENT_DIAGNOSTICS } from "./development-diagnostics";
import { isFixtureDocument, StudentCenterIntegration } from "./student-center-integration";

async function bootstrap(): Promise<void> {
  const diagnostics = ENABLE_DEVELOPMENT_DIAGNOSTICS ? new DevelopmentDiagnostics(document) : undefined;
  try {
    const [professors, preferences] = await Promise.all([
      mockProfessorDataService.getProfessorResults(),
      loadPreferences(),
    ]);

    const integration = new StudentCenterIntegration({
      document,
      professors,
      preferences,
      diagnostics,
      // Real Student Center instructors must not be paired with mock ratings.
      useMockData: isFixtureDocument(document),
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

import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { DevelopmentDiagnostics, ENABLE_DEVELOPMENT_DIAGNOSTICS } from "./development-diagnostics";
import { isFixtureDocument, StudentCenterIntegration } from "./student-center-integration";

async function bootstrap(): Promise<void> {
  const diagnostics = ENABLE_DEVELOPMENT_DIAGNOSTICS ? new DevelopmentDiagnostics(document) : undefined;
  try {
    const professors = await mockProfessorDataService.getProfessorResults();
    new StudentCenterIntegration({
      document,
      professors,
      diagnostics,
      // Real Student Center instructors must never receive mock ratings.
      useMockData: isFixtureDocument(document),
    }).start();
  } catch {
    diagnostics?.renderingError();
  }
}

void bootstrap();

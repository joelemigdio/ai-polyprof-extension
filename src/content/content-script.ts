import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { isFixtureDocument, StudentCenterIntegration } from "./student-center-integration";

async function bootstrap(): Promise<void> {
  const professors = await mockProfessorDataService.getProfessorResults();
  new StudentCenterIntegration({
    document,
    professors,
    // Real Student Center instructors must never receive mock ratings.
    useMockData: isFixtureDocument(document),
  }).start();
}

void bootstrap();

/** @vitest-environment jsdom */
import { expect, it } from "vitest";
import { DevelopmentDiagnostics } from "./development-diagnostics";

it("shows non-sensitive content-script and integration stages in a removable badge", () => {
  const diagnostics = new DevelopmentDiagnostics(document);
  const badge = document.querySelector<HTMLElement>("#ai-polyratings-development-diagnostics")!;
  expect(badge.shadowRoot?.textContent).toContain("Script Loaded");
  diagnostics.instructorFieldsFound(13);
  expect(badge.shadowRoot?.textContent).toContain("13 Instructor Fields");
  diagnostics.professorTargetsExtracted(2);
  expect(badge.shadowRoot?.textContent).toContain("2 Professors Found");
  diagnostics.surfaceTargetsFound({ classSearch: 4, myScheduleMainRow: 2, myScheduleExpandedDetail: 1, scheduleBuilder: 3 });
  expect(badge.shadowRoot?.textContent).toContain("Search 4");
  expect(badge.shadowRoot?.textContent).toContain("Main 2");
  expect(badge.shadowRoot?.textContent).toContain("Details 1");
  expect(badge.shadowRoot?.textContent).toContain("Builder 3");
  diagnostics.hoverEventReceived();
  expect(badge.shadowRoot?.textContent).toContain("Hover Event Received");
  diagnostics.hoverCardRendered();
  expect(badge.shadowRoot?.textContent).toContain("Hover Card Rendered");
  diagnostics.hoverCardDismissed();
  expect(badge.shadowRoot?.textContent).toContain("Hover Card Dismissed");
  badge.remove();
});

import type { Professor } from "../models/professor";
import { mockReviewSummaryService } from "../services/mock-review-summary-service";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { findInstructorCandidates, type InstructorCandidate } from "./student-center-adapter";

const injectedMarker = "data-polyratings-button-injected";

export interface StudentCenterIntegrationOptions {
  document: Document;
  professors: Professor[];
  useMockData: boolean;
}

export class StudentCenterIntegration {
  private observer: MutationObserver | null = null;
  private scanQueued = false;

  constructor(private readonly options: StudentCenterIntegrationOptions) {}

  start(): void {
    this.injectStyles();
    this.scan();
    this.observer = new MutationObserver(() => this.queueScan());
    this.observer.observe(this.options.document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
  }

  scan(): void {
    for (const candidate of findInstructorCandidates(this.options.document)) {
      if (!candidate.element.hasAttribute(injectedMarker)) this.injectButton(candidate);
    }
  }

  private queueScan(): void {
    if (this.scanQueued) return;
    this.scanQueued = true;
    window.setTimeout(() => {
      this.scanQueued = false;
      this.scan();
    }, 50);
  }

  private injectButton(candidate: InstructorCandidate): void {
    candidate.element.setAttribute(injectedMarker, "true");
    const button = this.options.document.createElement("button");
    button.type = "button";
    button.className = "polyratings-view-button";
    button.textContent = "View PolyRatings";
    button.setAttribute("aria-label", `View PolyRatings for ${candidate.instructorName.replace(/\s+/g, " ").trim()}`);
    button.addEventListener("click", () => this.openDetails(candidate));
    candidate.element.append(" ", button);
  }

  private openDetails(candidate: InstructorCandidate): void {
    const professor = this.options.useMockData
      ? findConfidentProfessor(candidate.instructorName, this.options.professors)
      : null;
    const overlay = this.options.document.createElement("section");
    overlay.className = "polyratings-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "PolyRatings professor information");
    overlay.tabIndex = -1;

    const panel = this.options.document.createElement("div");
    panel.className = "polyratings-panel";
    const close = this.options.document.createElement("button");
    close.type = "button";
    close.className = "polyratings-close-button";
    close.textContent = "Close";
    close.addEventListener("click", () => overlay.remove());
    panel.append(close);

    if (professor) {
      this.renderProfessor(panel, professor, candidate.courseCode);
    } else {
      const heading = this.options.document.createElement("h2");
      heading.textContent = "No PolyRatings information available for this professor.";
      const detail = this.options.document.createElement("p");
      detail.textContent = "No confident match was found. No ratings or reviews have been substituted.";
      panel.append(heading, detail);
    }

    overlay.append(panel);
    this.options.document.body.append(overlay);
    overlay.focus();
  }

  private renderProfessor(panel: HTMLElement, professor: Professor, courseCode: string | null): void {
    const reviews = professor.reviews ?? [];
    const insights = mockReviewSummaryService.getInsights(reviews);
    const heading = this.options.document.createElement("h2");
    heading.textContent = professor.name;
    const context = this.options.document.createElement("p");
    context.textContent = `${professor.department} · ${professor.overallRating.toFixed(1)} / 5 · ${professor.reviewCount} demo reviews${courseCode ? ` · ${courseCode}` : ""}`;
    const disclosure = this.options.document.createElement("p");
    disclosure.className = "polyratings-demo-disclosure";
    disclosure.textContent = "Demo data only — not live PolyRatings data.";
    panel.append(heading, context, disclosure);

    this.appendSection(panel, "Review Summary", insights.summary ?? "No reviews are available to summarize.");
    this.appendSection(panel, "Common Review Themes", insights.themes.length ? insights.themes.join(" · ") : "Not enough review information for recurring themes.");
    this.appendSection(panel, "Rating Traits", (professor.ratingTraits ?? []).map((trait) => `${trait.name}: ${trait.score.toFixed(1)} / 5`).join(" · ") || "No rating traits are available.");
    this.appendSection(panel, "Student Reviews", reviews.length ? reviews.map((review) => `${review.courseCode}: ${review.text}`).join(" ") : "No individual reviews are available.");
  }

  private appendSection(panel: HTMLElement, title: string, content: string): void {
    const heading = this.options.document.createElement("h3");
    heading.textContent = title;
    const paragraph = this.options.document.createElement("p");
    paragraph.textContent = content;
    panel.append(heading, paragraph);
  }

  private injectStyles(): void {
    if (this.options.document.querySelector("[data-polyratings-content-styles]")) return;
    const style = this.options.document.createElement("style");
    style.setAttribute("data-polyratings-content-styles", "true");
    style.textContent = `.polyratings-view-button{background:#1e5c44;border:0;border-radius:4px;color:#fff;cursor:pointer;font:600 12px system-ui,sans-serif;margin:4px;padding:4px 7px}.polyratings-view-button:focus-visible,.polyratings-close-button:focus-visible{outline:3px solid #d2a800;outline-offset:2px}.polyratings-overlay{align-items:center;background:rgb(0 0 0 / .42);display:flex;inset:0;justify-content:center;position:fixed;z-index:2147483647}.polyratings-panel{background:#f7f5ef;border:3px solid #d2a800;border-radius:10px;color:#1e3932;max-height:85vh;max-width:470px;overflow:auto;padding:20px;width:calc(100% - 32px)}.polyratings-panel h2{font-size:20px;margin:0 0 6px}.polyratings-panel h3{font-size:15px;margin:16px 0 4px}.polyratings-panel p{font:14px/1.45 system-ui,sans-serif;margin:0}.polyratings-close-button{background:#1e5c44;border:0;border-radius:4px;color:#fff;cursor:pointer;float:right;font:600 13px system-ui,sans-serif;padding:6px 10px}.polyratings-demo-disclosure{color:#685300;font-weight:700;margin-top:8px!important}`;
    this.options.document.head.append(style);
  }
}

export function isFixtureDocument(document: Document): boolean {
  return document.documentElement.hasAttribute("data-polyratings-fixture");
}

export { normalizeInstructorName };

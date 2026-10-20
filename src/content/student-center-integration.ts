import type { Professor } from "../models/professor";
import { mockReviewSummaryService } from "../services/mock-review-summary-service";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { createInstructorCandidate, findInstructorDetection, type InstructorCandidate } from "./student-center-adapter";
import type { IntegrationDiagnostics } from "./development-diagnostics";

const hoverDelayMs = 250;
const hideDelayMs = 140;

export interface StudentCenterIntegrationOptions {
  document: Document;
  professors: Professor[];
  useMockData: boolean;
  diagnostics?: IntegrationDiagnostics;
}

export class StudentCenterIntegration {
  private observer: MutationObserver | null = null;
  private scanQueued = false;
  private showTimer: number | null = null;
  private hideTimer: number | null = null;
  private activeCandidate: InstructorCandidate | null = null;
  private readonly boundTargets = new WeakSet<HTMLElement>();
  private host: HTMLElement | null = null;

  constructor(private readonly options: StudentCenterIntegrationOptions) {}

  start(): void {
    this.ensureHoverHost();
    this.scan();
    this.options.document.addEventListener("keydown", this.handleKeydown);
    this.observer = new MutationObserver(() => this.queueScan());
    this.observer.observe(this.options.document.body, { attributes: true, attributeFilter: ["data-name"], childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.options.document.removeEventListener("keydown", this.handleKeydown);
    this.clearTimers();
    this.host?.remove();
    this.host = null;
  }

  scan(): void {
    const detection = findInstructorDetection(this.options.document);
    const { candidates } = detection;
    this.options.diagnostics?.instructorFieldsFound(detection.instructorFieldCount);
    this.options.diagnostics?.professorTargetsExtracted(candidates.length);
    this.options.diagnostics?.surfaceTargetsFound({
      myScheduleMainRow: detection.myScheduleMainRowTargets,
      myScheduleExpandedDetail: detection.myScheduleExpandedDetailTargets,
      scheduleBuilder: detection.scheduleBuilderTargets,
    });
    for (const candidate of candidates) {
      if (!this.boundTargets.has(candidate.element)) this.bindTarget(candidate);
    }
  }

  private queueScan(): void {
    if (this.scanQueued) return;
    this.scanQueued = true;
    window.setTimeout(() => { this.scanQueued = false; this.scan(); }, 50);
  }

  private bindTarget(candidate: InstructorCandidate): void {
    this.boundTargets.add(candidate.element);
    candidate.element.setAttribute("data-polyratings-hover-target", "true");
    if (!candidate.element.hasAttribute("tabindex")) candidate.element.tabIndex = 0;
    candidate.element.setAttribute("aria-haspopup", "dialog");
    candidate.element.setAttribute("aria-label", `View PolyRatings for ${candidate.displayName.replace(/\s+/g, " ").trim()}`);
    candidate.element.addEventListener("pointerenter", () => {
      this.options.diagnostics?.hoverEventReceived();
      this.scheduleShow(this.currentCandidate(candidate), true);
    });
    candidate.element.addEventListener("pointerleave", () => this.scheduleHide());
    candidate.element.addEventListener("focus", () => this.show(this.currentCandidate(candidate)));
    candidate.element.addEventListener("blur", () => this.scheduleHide());
    candidate.element.addEventListener("click", () => this.show(this.currentCandidate(candidate)));
  }

  private currentCandidate(candidate: InstructorCandidate): InstructorCandidate {
    return candidate.element.matches("span.prof-name[data-name]") ? createInstructorCandidate(candidate.element) : candidate;
  }

  private scheduleShow(candidate: InstructorCandidate, delayed: boolean): void {
    this.cancelHide();
    if (!delayed) return this.show(candidate);
    if (this.activeCandidate?.element === candidate.element) return;
    this.cancelShow();
    this.showTimer = window.setTimeout(() => this.show(candidate), hoverDelayMs);
  }

  private show(candidate: InstructorCandidate): void {
    try {
      this.cancelShow();
      this.cancelHide();
      this.activeCandidate = candidate;
      const host = this.ensureHoverHost();
      const card = host.shadowRoot?.querySelector<HTMLElement>(".card");
      if (!card) throw new Error("Hover card missing");
      this.renderCard(card, candidate);
      const rect = candidate.element.getBoundingClientRect();
      const cardWidth = 320;
      host.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - cardWidth - 8))}px`;
      host.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 100))}px`;
      host.hidden = false;
      this.options.diagnostics?.hoverCardRendered();
    } catch {
      this.options.diagnostics?.renderingError();
    }
  }

  private scheduleHide(): void {
    this.cancelShow();
    this.cancelHide();
    this.hideTimer = window.setTimeout(() => this.hide(), hideDelayMs);
  }

  private hide(): void {
    this.cancelHide();
    if (this.host) this.host.hidden = true;
    this.activeCandidate = null;
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.hide();
  };

  private clearTimers(): void { this.cancelShow(); this.cancelHide(); }
  private cancelShow(): void { if (this.showTimer !== null) { window.clearTimeout(this.showTimer); this.showTimer = null; } }
  private cancelHide(): void { if (this.hideTimer !== null) { window.clearTimeout(this.hideTimer); this.hideTimer = null; } }

  private ensureHoverHost(): HTMLElement {
    if (this.host?.isConnected) return this.host;
    const host = this.options.document.createElement("div");
    host.id = "polyratings-hover-host";
    host.hidden = true;
    host.style.cssText = "position:fixed;z-index:2147483647;max-width:calc(100vw - 16px);";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>:host{all:initial}.card{background:#f7f5ef;border:2px solid #d2a800;border-radius:10px;box-shadow:0 8px 24px rgb(0 0 0 / .22);box-sizing:border-box;color:#1e3932;font:14px/1.45 system-ui,sans-serif;max-height:70vh;overflow:auto;padding:14px;width:min(320px,calc(100vw - 16px))}h2{font-size:16px;margin:0 24px 4px 0}h3{font-size:13px;margin:12px 0 3px}p{margin:0}.meta{color:#53665e}.notice{color:#685300;font-size:12px;font-weight:700;margin-top:8px}.details{background:#1e5c44;border:0;border-radius:5px;color:white;cursor:pointer;font:700 12px system-ui,sans-serif;margin-top:12px;padding:7px 9px}.close{background:transparent;border:0;color:#1e5c44;cursor:pointer;float:right;font:700 12px system-ui,sans-serif;padding:0}.details:focus-visible,.close:focus-visible{outline:3px solid #d2a800;outline-offset:2px}</style><section class="card" role="dialog" aria-label="PolyRatings professor information"></section>`;
    const card = shadow.querySelector<HTMLElement>(".card")!;
    card.addEventListener("pointerenter", () => this.cancelHide());
    card.addEventListener("pointerleave", () => this.scheduleHide());
    this.options.document.body.append(host);
    this.host = host;
    return host;
  }

  private renderCard(card: HTMLElement, candidate: InstructorCandidate): void {
    card.replaceChildren();
    const close = this.options.document.createElement("button");
    close.className = "close";
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => this.hide());
    card.append(close);
    const professor = this.options.useMockData ? findConfidentProfessor(candidate.instructorName, this.options.professors) : null;
    if (!professor) {
      const heading = this.options.document.createElement("h2");
      heading.textContent = candidate.displayName;
      const message = this.options.document.createElement("p");
      message.textContent = "PolyRatings information is not available yet.";
      card.append(heading, message);
      return;
    }

    const reviews = professor.reviews ?? [];
    const insights = mockReviewSummaryService.getInsights(reviews);
    const heading = this.options.document.createElement("h2");
    heading.textContent = professor.name;
    const meta = this.options.document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${professor.overallRating.toFixed(1)} / 5 · ${professor.reviewCount} demo reviews`;
    card.append(heading, meta);
    for (const traitName of ["Workload", "Difficulty"]) {
      const trait = professor.ratingTraits?.find((item) => item.name === traitName);
      if (trait) this.appendSection(card, traitName, `${trait.score.toFixed(1)} / 5`);
    }
    this.appendSection(card, "Review Summary", insights.summary ?? "No reviews are available to summarize.");
    const disclosure = this.options.document.createElement("p");
    disclosure.className = "notice";
    disclosure.textContent = "Demo data only — not live PolyRatings data.";
    const details = this.options.document.createElement("button");
    details.className = "details";
    details.type = "button";
    details.textContent = "View Full Details";
    details.addEventListener("click", () => this.openDetails(candidate));
    card.append(disclosure, details);
  }

  private appendSection(card: HTMLElement, title: string, content: string): void {
    const heading = this.options.document.createElement("h3");
    heading.textContent = title;
    const paragraph = this.options.document.createElement("p");
    paragraph.textContent = content;
    card.append(heading, paragraph);
  }

  private openDetails(candidate: InstructorCandidate): void {
    this.hide();
    const professor = this.options.useMockData ? findConfidentProfessor(candidate.instructorName, this.options.professors) : null;
    if (!professor) return;
    // The fixture's full-details action shares the existing model and insight service;
    // production cards never expose mock details for real instructors.
    const overlay = this.options.document.createElement("section");
    overlay.className = "polyratings-overlay";
    overlay.style.cssText = "align-items:center;background:rgb(0 0 0 / .42);display:flex;inset:0;justify-content:center;position:fixed;z-index:2147483647;";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const panel = this.options.document.createElement("div");
    panel.className = "polyratings-panel";
    panel.style.cssText = "background:#f7f5ef;border:3px solid #d2a800;border-radius:10px;color:#1e3932;max-width:470px;padding:20px;width:calc(100% - 32px);";
    const close = this.options.document.createElement("button");
    close.type = "button"; close.textContent = "Close"; close.addEventListener("click", () => overlay.remove());
    const heading = this.options.document.createElement("h2"); heading.textContent = professor.name;
    const content = this.options.document.createElement("p"); content.textContent = `Overall rating: ${professor.overallRating.toFixed(1)} / 5. ${mockReviewSummaryService.getInsights(professor.reviews ?? []).summary ?? ""}`;
    panel.append(close, heading, content); overlay.append(panel); this.options.document.body.append(overlay);
  }
}

export function isFixtureDocument(document: Document): boolean {
  return document.documentElement.hasAttribute("data-polyratings-fixture");
}

export { normalizeInstructorName };

import hoverCardStyles from "./hover-card.css?inline";
import type { Professor } from "../models/professor";
import { createDefaultPreferences, traitLabel, type StudentPreferences } from "../models/preferences";
import { buildClassSummary, matchProfessor, rankProfessors } from "../services/preference-matching";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { findClassRows, findInstructorDetection, groupCandidatesIntoRows, type ClassRow } from "./student-center-adapter";
import type { IntegrationDiagnostics } from "./development-diagnostics";

const hoverDelayMs = 250;
const hideDelayMs = 140;
const cardWidth = 340;

export interface StudentCenterIntegrationOptions {
  document: Document;
  professors: Professor[];
  useMockData: boolean;
  preferences?: StudentPreferences;
  diagnostics?: IntegrationDiagnostics;
}

interface ResolvedRow {
  row: ClassRow;
  rated: Professor[];
  unratedNames: string[];
}

export class StudentCenterIntegration {
  private observer: MutationObserver | null = null;
  private scanQueued = false;
  private showTimer: number | null = null;
  private hideTimer: number | null = null;
  private activeRow: ClassRow | null = null;
  private readonly boundTargets = new WeakSet<HTMLElement>();
  private host: HTMLElement | null = null;
  private preferences: StudentPreferences;

  constructor(private readonly options: StudentCenterIntegrationOptions) {
    this.preferences = options.preferences ?? createDefaultPreferences();
  }

  start(): void {
    this.ensureHoverHost();
    this.scan();
    this.options.document.addEventListener("keydown", this.handleKeydown);
    this.observer = new MutationObserver(() => this.queueScan());
    this.observer.observe(this.options.document.body, {
      attributes: true,
      attributeFilter: ["data-name"],
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.options.document.removeEventListener("keydown", this.handleKeydown);
    this.clearTimers();
    this.host?.remove();
    this.host = null;
  }

  /** Re-renders an open card so a preference change is reflected immediately. */
  updatePreferences(preferences: StudentPreferences): void {
    this.preferences = preferences;
    if (this.activeRow) this.show(this.activeRow);
  }

  scan(): void {
    const detection = findInstructorDetection(this.options.document);
    this.options.diagnostics?.instructorFieldsFound(detection.instructorFieldCount);
    this.options.diagnostics?.professorTargetsExtracted(detection.candidates.length);
    this.options.diagnostics?.surfaceTargetsFound({
      myScheduleMainRow: detection.myScheduleMainRowTargets,
      myScheduleExpandedDetail: detection.myScheduleExpandedDetailTargets,
      scheduleBuilder: detection.scheduleBuilderTargets,
    });
    for (const row of groupCandidatesIntoRows(detection.candidates)) {
      if (!this.boundTargets.has(row.element)) this.bindTarget(row);
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

  private bindTarget(row: ClassRow): void {
    this.boundTargets.add(row.element);
    row.element.setAttribute("data-polyratings-hover-target", "true");
    if (!row.element.hasAttribute("tabindex")) row.element.tabIndex = 0;
    row.element.setAttribute("aria-haspopup", "dialog");
    row.element.setAttribute("aria-label", this.describeRow(row));
    row.element.addEventListener("pointerenter", () => {
      this.options.diagnostics?.hoverEventReceived();
      this.scheduleShow(this.currentRow(row));
    });
    row.element.addEventListener("pointerleave", () => this.scheduleHide());
    row.element.addEventListener("focus", () => this.show(this.currentRow(row)));
    row.element.addEventListener("blur", () => this.scheduleHide());
    row.element.addEventListener("click", () => this.show(this.currentRow(row)));
  }

  private describeRow(row: ClassRow): string {
    const names = row.instructors.map((instructor) => instructor.displayName).join(", ");
    return row.courseCode
      ? `View PolyProf ratings for ${row.courseCode}: ${names}`
      : `View PolyProf ratings for ${names}`;
  }

  /** Re-reads the row so instructors added after binding are picked up. */
  private currentRow(row: ClassRow): ClassRow {
    return findClassRows(this.options.document).find((candidate) => candidate.element === row.element) ?? row;
  }

  private resolveRow(row: ClassRow): ResolvedRow {
    const rated: Professor[] = [];
    const unratedNames: string[] = [];

    for (const instructor of row.instructors) {
      const professor = this.options.useMockData
        ? findConfidentProfessor(instructor.instructorName, this.options.professors)
        : null;
      if (professor && !rated.includes(professor)) rated.push(professor);
      else if (!professor) unratedNames.push(instructor.displayName);
    }

    return { row, rated: rankProfessors(rated, this.preferences), unratedNames };
  }

  private scheduleShow(row: ClassRow): void {
    this.cancelHide();
    if (this.activeRow?.element === row.element) return;
    this.cancelShow();
    this.showTimer = window.setTimeout(() => this.show(row), hoverDelayMs);
  }

  private show(row: ClassRow): void {
    try {
      this.cancelShow();
      this.cancelHide();
      this.activeRow = row;
      const host = this.ensureHoverHost();
      const card = host.shadowRoot?.querySelector<HTMLElement>(".card");
      if (!card) throw new Error("Hover card missing");

      this.renderList(card, this.resolveRow(row));
      const rect = row.element.getBoundingClientRect();
      host.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - cardWidth - 8))}px`;
      host.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 120))}px`;
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
    this.activeRow = null;
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.hide();
  };

  private clearTimers(): void {
    this.cancelShow();
    this.cancelHide();
  }

  private cancelShow(): void {
    if (this.showTimer !== null) {
      window.clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private ensureHoverHost(): HTMLElement {
    if (this.host?.isConnected) return this.host;
    const host = this.options.document.createElement("div");
    host.id = "polyratings-hover-host";
    host.hidden = true;
    host.style.cssText = "position:fixed;z-index:2147483647;max-width:calc(100vw - 16px);";
    const shadow = host.attachShadow({ mode: "open" });
    const style = this.options.document.createElement("style");
    style.textContent = hoverCardStyles;
    const card = this.options.document.createElement("section");
    card.className = "card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "PolyProf professor information");
    card.addEventListener("pointerenter", () => this.cancelHide());
    card.addEventListener("pointerleave", () => this.scheduleHide());
    shadow.append(style, card);
    this.options.document.body.append(host);
    this.host = host;
    return host;
  }

  private element(tag: string, className?: string, text?: string): HTMLElement {
    const node = this.options.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  private renderHead(card: HTMLElement, title: string, subtitle: string): void {
    const head = this.element("header", "head");
    const group = this.element("div");
    group.append(this.element("h2", undefined, title), this.element("span", "sub", subtitle));
    const close = this.element("button", "close", "Close") as HTMLButtonElement;
    close.type = "button";
    close.addEventListener("click", () => this.hide());
    head.append(group, close);
    card.append(head, this.element("p", "demo", "Demo data — invented ratings, not real PolyRatings"));
  }

  private renderPills(professor: Professor): HTMLElement {
    const pills = this.element("div", "pills");
    const star = this.element("span", "pill star", `★ ${professor.starRating.toFixed(1)}`);
    star.setAttribute("aria-label", `Overall rating ${professor.starRating.toFixed(1)} out of 5`);
    const peer = this.element("span", "pill peer", `◉ ${professor.peerRating.toFixed(1)}`);
    peer.setAttribute("aria-label", `Similar-student rating ${professor.peerRating.toFixed(1)} out of 5`);
    pills.append(star, peer);
    return pills;
  }

  private renderList(card: HTMLElement, resolved: ResolvedRow): void {
    card.replaceChildren();
    const count = resolved.rated.length + resolved.unratedNames.length;
    this.renderHead(
      card,
      resolved.row.courseCode ?? "This class",
      `${count} ${count === 1 ? "professor" : "professors"}`,
    );

    const body = this.element("div", "body");

    for (const professor of resolved.rated) {
      const button = this.element("button", "prof") as HTMLButtonElement;
      button.type = "button";
      const top = this.element("div", "prof-top");
      const identity = this.element("div", "identity");
      identity.append(
        this.element("p", "prof-name", professor.name),
        this.element("p", "prof-meta", `${professor.department} • ${professor.reviewCount} reviews`),
      );
      top.append(identity, this.renderPills(professor));
      button.append(top, this.element("p", "fit", matchProfessor(professor, this.preferences).fitLine));
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.renderDetail(card, resolved, professor);
      });
      body.append(button);
    }

    for (const name of resolved.unratedNames) {
      body.append(this.element("p", "unrated", `${name} — no ratings available yet`));
    }

    body.append(this.renderSummary(resolved.rated));
    card.append(body);
  }

  private renderSummary(professors: Professor[]): HTMLElement {
    const summary = this.element("section", "summary");
    summary.append(
      this.element("h3", undefined, "Personalized summary"),
      this.element("p", undefined, buildClassSummary(professors, this.preferences)),
      this.element("p", "note", "Generated from your saved preferences. No AI model is used in this build."),
    );
    return summary;
  }

  private renderDetail(card: HTMLElement, resolved: ResolvedRow, professor: Professor): void {
    card.replaceChildren();
    this.renderHead(card, professor.name, professor.department);

    const body = this.element("div", "body");
    const back = this.element("button", "back", "← Back to professors") as HTMLButtonElement;
    back.type = "button";
    back.addEventListener("click", (event) => {
      event.stopPropagation();
      this.renderList(card, resolved);
    });
    body.append(back);

    const overview = this.element("div", "prof");
    const top = this.element("div", "prof-top");
    const identity = this.element("div", "identity");
    identity.append(
      this.element("p", "prof-name", professor.name),
      this.element("p", "prof-meta", `${professor.courses.join(", ")} • ${professor.reviewCount} reviews`),
    );
    top.append(identity, this.renderPills(professor));
    overview.append(top, this.element("p", "fit", matchProfessor(professor, this.preferences).fitLine));
    body.append(overview);

    if (professor.traits.length > 0) {
      const tagCard = this.element("div", "detail-card");
      tagCard.append(this.element("h3", undefined, "Tags"));
      const tags = this.element("div", "tags");
      for (const trait of professor.traits) tags.append(this.element("span", "tag", traitLabel(trait)));
      tagCard.append(tags);
      body.append(tagCard);
    }

    const reviewCard = this.element("div", "detail-card");
    reviewCard.append(this.element("h3", undefined, `Top reviews (${professor.reviewCount} total)`));
    if (professor.reviews.length === 0) {
      reviewCard.append(this.element("p", undefined, "No reviews are available for this professor yet."));
    } else {
      for (const review of professor.reviews) {
        const item = this.element("article", "review");
        const head = this.element("div", "review-head");
        head.append(
          this.element("span", "review-origin", `${review.classYear} • ${review.courseCode}`),
          this.element("span", "pill star", `★ ${review.rating.toFixed(1)}`),
        );
        item.append(head, this.element("p", undefined, review.text));
        reviewCard.append(item);
      }
    }
    body.append(reviewCard);
    card.append(body);
  }
}

export function isFixtureDocument(document: Document): boolean {
  return document.documentElement.hasAttribute("data-polyratings-fixture");
}

export { normalizeInstructorName };

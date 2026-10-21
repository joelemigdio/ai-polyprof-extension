import hoverCardStyles from "./hover-card.css?inline";
import { formatRating, ratingScaleMax, scopeToCourse, type CourseScopedRating, type Professor } from "../models/professor";
import { createDefaultPreferences, type StudentPreferences } from "../models/preferences";
import { courseAliases, courseTitle } from "../data/course-crosswalk";
import { buildClassSummary, matchProfessor, rankProfessors } from "../services/preference-matching";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { findClassRows, findInstructorDetection, groupCandidatesIntoRows, type ClassRow } from "./student-center-adapter";
import type { IntegrationDiagnostics } from "./development-diagnostics";

const hoverDelayMs = 250;
const hideDelayMs = 140;
const cardWidth = 340;
const maxReviewsShown = 4;

/** Supplies review text for one professor; the index alone carries only scores. */
export interface ProfessorDetailSource {
  getProfessorDetail(id: string): Promise<Professor>;
}

export interface StudentCenterIntegrationOptions {
  document: Document;
  professors: Professor[];
  details?: ProfessorDetailSource;
  preferences?: StudentPreferences;
  diagnostics?: IntegrationDiagnostics;
}

interface ResolvedRow {
  row: ClassRow;
  rated: Professor[];
  unratedNames: string[];
  /** Codes this class's reviews could be filed under, oldest numbering included. */
  aliases: string[];
}

export class StudentCenterIntegration {
  private observer: MutationObserver | null = null;
  private scanQueued = false;
  private showTimer: number | null = null;
  private hideTimer: number | null = null;
  private activeRow: ClassRow | null = null;
  private readonly boundTargets = new WeakSet<HTMLElement>();
  private readonly details = new Map<string, Professor>();
  /** Set while the card shows one professor's detail view rather than the list. */
  private activeProfessorId: string | null = null;
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
    if (this.activeRow) this.refresh(this.activeRow);
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
      const match = findConfidentProfessor(instructor.instructorName, this.options.professors);
      // Prefer the fetched record so reviews appear once they have loaded.
      const professor = match && (this.details.get(match.id) ?? match);
      if (professor && !rated.some((existing) => existing.id === professor.id)) rated.push(professor);
      else if (!professor) unratedNames.push(instructor.displayName);
    }

    return {
      row,
      rated: rankProfessors(rated, this.preferences),
      unratedNames,
      aliases: row.courseCode ? courseAliases(row.courseCode) : [],
    };
  }

  /**
   * Fetches review text for the professors on an open card, then re-renders if
   * the student is still hovering the same class. Index ratings stay on screen
   * while this runs, and a failed fetch simply leaves the card without reviews.
   */
  private async loadDetails(row: ClassRow, resolved: ResolvedRow): Promise<void> {
    const source = this.options.details;
    if (!source) return;
    const pending = resolved.rated.filter((professor) => !this.details.has(professor.id));
    if (pending.length === 0) return;

    await Promise.all(
      pending.map(async (professor) => {
        try {
          this.details.set(professor.id, await source.getProfessorDetail(professor.id));
        } catch {
          this.options.diagnostics?.renderingError();
        }
      }),
    );

    if (this.activeRow?.element === row.element) this.refresh(row);
  }

  /** Re-renders in place, keeping an open detail view open. */
  private refresh(row: ClassRow): void {
    const card = this.host?.shadowRoot?.querySelector<HTMLElement>(".card");
    if (!card) return;
    const resolved = this.resolveRow(row);
    const open = resolved.rated.find((professor) => professor.id === this.activeProfessorId);
    if (open) this.renderDetail(card, resolved, open);
    else this.renderList(card, resolved);
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

      const resolved = this.resolveRow(row);
      this.renderList(card, resolved);
      void this.loadDetails(row, resolved);
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
    this.activeProfessorId = null;
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
    card.append(head);
  }

  private renderPills(professor: Professor): HTMLElement {
    const pills = this.element("div", "pills");
    const star = this.element("span", "pill star", `★ ${formatRating(professor.starRating)}`);
    star.setAttribute("aria-label", `Overall rating ${formatRating(professor.starRating)} out of ${ratingScaleMax}`);
    star.title = `PolyRatings overall rating, ${formatRating(professor.starRating)} out of ${ratingScaleMax}`;
    const clarity = this.element("span", "pill peer", `◉ ${formatRating(professor.clarityRating)}`);
    clarity.setAttribute(
      "aria-label",
      `Presents material clearly ${formatRating(professor.clarityRating)} out of ${ratingScaleMax}`,
    );
    clarity.title = `Presents material clearly, ${formatRating(professor.clarityRating)} out of ${ratingScaleMax}`;
    pills.append(star, clarity);
    return pills;
  }

  /** States this professor's record for the hovered class specifically. */
  private renderCourseLine(courseCode: string, scoped: CourseScopedRating, hasReviews: boolean): HTMLElement {
    if (scoped.reviewCount > 0) {
      const count = `${scoped.reviewCount} ${scoped.reviewCount === 1 ? "review" : "reviews"}`;
      return this.element("p", "course-line", `In ${courseCode}: ★ ${formatRating(scoped.rating ?? 0)} from ${count}`);
    }
    return this.element(
      "p",
      "course-line muted",
      hasReviews ? `No reviews filed under ${courseCode}` : `Loading ${courseCode} reviews…`,
    );
  }

  private renderList(card: HTMLElement, resolved: ResolvedRow): void {
    this.activeProfessorId = null;
    card.replaceChildren();
    const count = resolved.rated.length + resolved.unratedNames.length;
    const courseCode = resolved.row.courseCode;
    const title = courseCode ? courseTitle(courseCode) : undefined;
    this.renderHead(
      card,
      courseCode ?? "This class",
      title ? `${title} • ${count} ${count === 1 ? "professor" : "professors"}` : `${count} ${count === 1 ? "professor" : "professors"}`,
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
      button.append(top);
      if (courseCode) {
        button.append(
          this.renderCourseLine(courseCode, scopeToCourse(professor, resolved.aliases), this.details.has(professor.id)),
        );
      }
      button.append(this.element("p", "fit", matchProfessor(professor, this.preferences).fitLine));
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
      this.element(
        "p",
        "note",
        `Fit is generated from your saved preferences; no AI model is used. Ratings and reviews come from PolyRatings, scored out of ${ratingScaleMax}.`,
      ),
    );
    return summary;
  }

  private renderDetail(card: HTMLElement, resolved: ResolvedRow, professor: Professor): void {
    this.activeProfessorId = professor.id;
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

    if (professor.tags.length > 0) {
      const tagCard = this.element("div", "detail-card");
      tagCard.append(this.element("h3", undefined, "Tags"));
      const tags = this.element("div", "tags");
      for (const tag of professor.tags) tags.append(this.element("span", "tag", tag));
      tagCard.append(tags);
      body.append(tagCard);
    }

    // Reviews for the hovered class lead, since that is what the student is
    // deciding about; the rest follow in recency order.
    const scoped = scopeToCourse(professor, resolved.aliases);
    const ordered = [...scoped.reviews, ...professor.reviews.filter((review) => !scoped.reviews.includes(review))];

    const reviewCard = this.element("div", "detail-card");
    reviewCard.append(this.element("h3", undefined, `Reviews (${professor.reviewCount} total)`));
    if (ordered.length === 0) {
      reviewCard.append(
        this.element("p", undefined, this.details.has(professor.id) ? "No reviews are available for this professor yet." : "Loading reviews…"),
      );
    } else {
      for (const review of ordered.slice(0, maxReviewsShown)) {
        const item = this.element("article", "review");
        const head = this.element("div", "review-head");
        head.append(
          this.element("span", "review-origin", `${review.classYear} • ${review.courseCode}`),
          this.element("span", "pill star", `★ ${formatRating(review.rating)}`),
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

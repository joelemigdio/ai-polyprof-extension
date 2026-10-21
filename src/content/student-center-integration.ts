import hoverCardStyles from "./hover-card.css?inline";
import type { Professor } from "../models/professor";
import { createDefaultPreferences, traitLabel, type StudentPreferences } from "../models/preferences";
import type { CourseProfessorComparison } from "../models/professor";
import { buildClassSummary, matchProfessor, rankProfessors } from "../services/preference-matching";
import { buildCourseProfessorComparisons } from "../services/course-professor-comparison";
import { CourseHoverCard, CourseProfessorComparisonView } from "./course-hover-card";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import {
  findClassRows,
  findCourseRows,
  findInstructorDetection,
  groupCandidatesIntoRows,
  type ClassRow,
  type CourseHoverRow,
} from "./student-center-adapter";
import type { IntegrationDiagnostics } from "./development-diagnostics";

const hoverDelayMs = 250;
const hideDelayMs = 200;
const cardWidth = 340;
const viewportPadding = 8;
const cardGap = 8;
const maxCardHeight = 420;

type CardOpenMode = "hover" | "click" | "focus" | null;

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

interface ResolvedCourseRow {
  row: CourseHoverRow;
  comparisons: CourseProfessorComparison[];
}

type HoverRow = ClassRow | CourseHoverRow;

function isCourseHoverRow(row: HoverRow): row is CourseHoverRow {
  return "course" in row;
}

export class StudentCenterIntegration {
  private observer: MutationObserver | null = null;
  private scanQueued = false;
  private showTimer: number | null = null;
  private hideTimer: number | null = null;
  private activeRow: HoverRow | null = null;
  private openMode: CardOpenMode = null;
  private hoveredTarget: HTMLElement | null = null;
  /** Keeps a manually closed hover card closed until the target is re-entered. */
  private dismissedTarget: HTMLElement | null = null;
  /**
   * Closing a card can reveal its instructor beneath the pointer, causing an
   * immediate synthetic pointerenter. Require a real pointerleave before that
   * same target may open a hover card again.
   */
  private dismissedTargetNeedsLeave = false;
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
    this.options.document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    this.options.document.addEventListener("click", this.handleDocumentClick, true);
    this.options.document.addEventListener("scroll", this.handleViewportChange, true);
    this.options.document.defaultView?.addEventListener("resize", this.handleViewportChange);
    this.observer = new MutationObserver(() => this.queueScan());
    this.observer.observe(this.options.document.body, {
      attributes: true,
      // PeopleSoft can update a rendered cart cell in place. Observe the
      // semantic attributes/text used by the adapter, scoped to this frame.
      attributeFilter: ["data-name", "title", "aria-hidden", "header"],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.options.document.removeEventListener("keydown", this.handleKeydown);
    this.options.document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    this.options.document.removeEventListener("click", this.handleDocumentClick, true);
    this.options.document.removeEventListener("scroll", this.handleViewportChange, true);
    this.options.document.defaultView?.removeEventListener("resize", this.handleViewportChange);
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
      classSearch: detection.classSearchTargets,
      shoppingCart: detection.shoppingCartTargets,
    });
    for (const row of groupCandidatesIntoRows(detection.candidates)) {
      if (!this.boundTargets.has(row.element)) this.bindTarget(row);
    }
    for (const row of findCourseRows(this.options.document)) {
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

  private bindTarget(row: HoverRow): void {
    this.boundTargets.add(row.element);
    if (isCourseHoverRow(row)) row.element.setAttribute("data-polyratings-course-hover-target", "true");
    else row.element.setAttribute("data-polyratings-hover-target", "true");
    const preservesNativeControl = isCourseHoverRow(row) && !row.clickOpensCard;
    // Course Selection's code target is an existing button. Do not overwrite
    // its accessible name, tab order, or click behavior; hover/focus remains
    // additive only.
    if (!preservesNativeControl) {
      if (!row.element.hasAttribute("tabindex")) row.element.tabIndex = 0;
      row.element.setAttribute("aria-haspopup", "dialog");
      row.element.setAttribute("aria-label", this.describeTarget(row));
    }
    row.element.addEventListener("pointerenter", () => {
      this.hoveredTarget = row.element;
      this.options.diagnostics?.hoverEventReceived();
      if (this.dismissedTarget === row.element && this.dismissedTargetNeedsLeave) return;
      if (this.dismissedTarget === row.element) this.clearManualDismissal();
      this.scheduleShow(this.currentTarget(row));
    });
    row.element.addEventListener("pointerleave", () => {
      if (this.hoveredTarget === row.element) this.hoveredTarget = null;
      if (this.dismissedTarget === row.element) this.dismissedTargetNeedsLeave = false;
      this.scheduleHide();
    });
    row.element.addEventListener("focus", () => {
      this.clearManualDismissal();
      this.show(this.currentTarget(row), "focus");
    });
    row.element.addEventListener("blur", () => this.scheduleHide());
    row.element.addEventListener("click", () => {
      if (isCourseHoverRow(row) && !row.clickOpensCard) return;
      this.clearManualDismissal();
      this.show(this.currentTarget(row), "click");
    });
  }

  private describeTarget(row: HoverRow): string {
    if (isCourseHoverRow(row)) {
      return row.course.title
        ? `View course information for ${row.course.code}: ${row.course.title}`
        : `View course information for ${row.course.code}`;
    }
    const names = row.instructors.map((instructor) => instructor.displayName).join(", ");
    return row.courseCode
      ? `View PolyProf ratings for ${row.courseCode}: ${names}`
      : `View PolyProf ratings for ${names}`;
  }

  /** Re-reads the target so instructors added after binding are picked up. */
  private currentTarget(row: HoverRow): HoverRow {
    if (isCourseHoverRow(row)) {
      return findCourseRows(this.options.document).find((candidate) => candidate.element === row.element) ?? row;
    }
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

  private resolveCourseRow(row: CourseHoverRow): ResolvedCourseRow {
    return {
      row,
      comparisons: buildCourseProfessorComparisons(row.instructors, this.options.professors, this.options.useMockData),
    };
  }

  private scheduleShow(row: HoverRow): void {
    this.cancelHide();
    if (this.dismissedTarget === row.element) return;
    if (this.activeRow?.element === row.element) return;
    this.cancelShow();
    this.showTimer = window.setTimeout(() => this.show(row, "hover"), hoverDelayMs);
  }

  private show(row: HoverRow, mode: Exclude<CardOpenMode, null> = this.openMode ?? "hover"): void {
    try {
      if (mode === "hover" && this.dismissedTarget === row.element) return;
      this.cancelShow();
      this.cancelHide();
      this.activeRow = row;
      this.openMode = mode;
      const host = this.ensureHoverHost();
      const card = host.shadowRoot?.querySelector<HTMLElement>(".card");
      if (!card) throw new Error("Hover card missing");

      if (isCourseHoverRow(row)) this.renderCourseList(card, this.resolveCourseRow(row));
      else this.renderList(card, this.resolveRow(row), row.source !== "shopping-cart");
      // A hidden element cannot be measured. Keep it visually hidden for one
      // layout pass, then position it in this document/frame's viewport.
      host.hidden = false;
      host.style.setProperty("display", "block", "important");
      host.style.visibility = "hidden";
      this.positionCard(row, host, card);
      host.style.visibility = "";
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
    this.cancelShow();
    this.cancelHide();
    if (this.host) {
      this.host.hidden = true;
      // Some Student Center styles apply broad rules to div elements. The
      // inline important value makes dismissal independent of page CSS.
      this.host.style.setProperty("display", "none", "important");
    }
    this.activeRow = null;
    this.openMode = null;
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.activeRow) return;
    event.preventDefault();
    event.stopPropagation();
    this.dismissManually();
  };

  private handleDocumentPointerDown = (event: Event): void => {
    if (this.eventTargetsCloseControl(event)) {
      this.handleCloseEvent(event);
      return;
    }
    if (this.openMode !== "click" || !this.activeRow || this.host?.hidden) return;
    const path = event.composedPath();
    if (path.includes(this.activeRow.element) || (this.host && path.includes(this.host))) return;
    this.dismissManually();
  };

  private handleDocumentClick = (event: Event): void => {
    if (this.eventTargetsCloseControl(event)) this.handleCloseEvent(event);
  };

  private eventTargetsCloseControl(event: Event): boolean {
    return event.composedPath().some((node) => (
      node instanceof HTMLElement && node.getAttribute("data-polyratings-action") === "close-card"
    ));
  }

  private handleCloseEvent(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.dismissManually();
  }

  private handleViewportChange = (): void => {
    if (!this.activeRow || !this.host || this.host.hidden) return;
    const card = this.host.shadowRoot?.querySelector<HTMLElement>(".card");
    if (card) this.positionCard(this.activeRow, this.host, card);
  };

  private dismissManually(): void {
    this.cancelShow();
    if (this.activeRow) {
      this.dismissedTarget = this.activeRow.element;
      this.dismissedTargetNeedsLeave = true;
    }
    this.hide();
    this.options.diagnostics?.hoverCardDismissed();
  }

  private clearManualDismissal(): void {
    this.dismissedTarget = null;
    this.dismissedTargetNeedsLeave = false;
  }

  private positionCard(row: HoverRow, host: HTMLElement, card: HTMLElement): void {
    const viewport = this.options.document.defaultView;
    const viewportWidth = viewport?.innerWidth ?? window.innerWidth;
    const viewportHeight = viewport?.innerHeight ?? window.innerHeight;
    const maxHeight = Math.max(1, Math.min(maxCardHeight, viewportHeight - (viewportPadding * 2 + cardGap)));
    card.style.maxHeight = `${maxHeight}px`;
    card.style.overflowY = "auto";

    const targetRect = row.element.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const width = Math.min(cardRect.width || cardWidth, Math.max(1, viewportWidth - viewportPadding * 2));
    const height = Math.min(cardRect.height || maxHeight, maxHeight);
    const roomBelow = viewportHeight - targetRect.bottom - cardGap - viewportPadding;
    // Prefer below only when the complete card fits. Otherwise anchor above
    // the instructor and clamp it into the current frame's viewport.
    const opensBelow = roomBelow >= height;
    const preferredTop = opensBelow ? targetRect.bottom + cardGap : targetRect.top - height - cardGap;
    const maxTop = Math.max(viewportPadding, viewportHeight - height - viewportPadding);
    const top = Math.max(viewportPadding, Math.min(preferredTop, maxTop));
    const maxLeft = Math.max(viewportPadding, viewportWidth - width - viewportPadding);
    const left = Math.max(viewportPadding, Math.min(targetRect.left, maxLeft));

    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;
  }

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
    // An extension reload can leave an inert host from the prior content
    // script in the document. Remove it before creating the active overlay.
    this.options.document.querySelectorAll("#polyratings-hover-host").forEach((existing) => existing.remove());
    const host = this.options.document.createElement("div");
    host.id = "polyratings-hover-host";
    host.hidden = true;
    host.style.cssText = "display:none!important;pointer-events:auto;position:fixed;z-index:2147483647;max-width:calc(100vw - 16px);";
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

  private renderHead(card: HTMLElement, title: string, subtitle: string, showClose = true): void {
    const head = this.element("header", "head");
    const group = this.element("div");
    group.append(this.element("h2", undefined, title), this.element("span", "sub", subtitle));
    head.append(group);
    if (showClose) {
      const close = this.element("button", "close", "Close") as HTMLButtonElement;
      close.type = "button";
      close.setAttribute("data-polyratings-action", "close-card");
      // Handle pointerdown so the card is gone before a page-level click handler
      // can react, while click remains available for keyboard activation.
      close.addEventListener("pointerdown", (event) => this.handleCloseEvent(event));
      close.addEventListener("click", (event) => this.handleCloseEvent(event));
      head.append(close);
    }
    card.append(head);
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

  private renderList(card: HTMLElement, resolved: ResolvedRow, showClose = true): void {
    card.replaceChildren();
    const count = resolved.rated.length + resolved.unratedNames.length;
    this.renderHead(
      card,
      resolved.row.courseCode ?? "This class",
      `${count} ${count === 1 ? "professor" : "professors"}`,
      showClose,
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
        this.renderDetail(card, resolved, professor, showClose);
      });
      body.append(button);
    }

    for (const name of resolved.unratedNames) {
      body.append(this.element("p", "unrated", `${name} — no ratings available yet`));
    }

    body.append(this.renderSummary(resolved.rated));
    card.append(body);
  }

  private renderCourseList(card: HTMLElement, resolved: ResolvedCourseRow): void {
    card.replaceChildren();
    this.renderHead(
      card,
      resolved.row.course.code,
      resolved.row.course.title ?? "Course title unavailable in this view",
    );
    card.append(CourseHoverCard({
      document: this.options.document,
      course: resolved.row.course,
      comparisons: resolved.comparisons,
      usesMockData: this.options.useMockData,
      onCompare: (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.renderCourseComparison(card, resolved);
      },
    }));
  }

  private renderCourseComparison(card: HTMLElement, resolved: ResolvedCourseRow): void {
    card.replaceChildren();
    this.renderHead(card, resolved.row.course.code, "Professor comparison");
    card.append(CourseProfessorComparisonView({
      document: this.options.document,
      comparisons: resolved.comparisons,
      usesMockData: this.options.useMockData,
      onBack: (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.renderCourseList(card, resolved);
      },
    }));
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

  private renderDetail(card: HTMLElement, resolved: ResolvedRow, professor: Professor, showClose = true): void {
    card.replaceChildren();
    this.renderHead(card, professor.name, professor.department, showClose);

    const body = this.element("div", "body");
    const back = this.element("button", "back", "← Back to professors") as HTMLButtonElement;
    back.type = "button";
    back.addEventListener("click", (event) => {
      event.stopPropagation();
      this.renderList(card, resolved, showClose);
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

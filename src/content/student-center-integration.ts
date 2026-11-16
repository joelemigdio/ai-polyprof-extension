import hoverCardStyles from "./hover-card.css?inline";
import {
  formatRating,
  ratingScaleMax,
  scopeToCourse,
  type CourseProfessorComparison,
  type CourseScopedRating,
  type Professor,
} from "../models/professor";
import { createDefaultPreferences, type StudentPreferences } from "../models/preferences";
import { favoriteId, type FavoriteClass } from "../models/favorites";
import { courseAliases, courseTitle } from "../data/course-crosswalk";
import { buildClassSummary, matchProfessor, rankProfessors } from "../services/preference-matching";
import { synthesizeReviews, type ReviewSynthesis } from "../services/review-synthesis";
import { buildRecommendationExplanation, describePreferenceFactors } from "../services/recommendation-explanation";
import { buildCourseProfessorComparisons, rankComparisons } from "../services/course-professor-comparison";
import { CourseHoverCard, CourseProfessorComparisonView, type CourseHoverCardProps } from "./course-hover-card";
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
  favorites?: FavoriteClass[];
  /** Persists a saved class. Omitted in tests and fixtures, which keep favorites in memory. */
  onToggleFavorite?: (favorite: FavoriteClass, isSaved: boolean) => void;
  diagnostics?: IntegrationDiagnostics;
}

interface ResolvedRow {
  row: ClassRow;
  rated: Professor[];
  unratedNames: string[];
  /** Codes this class's reviews could be filed under, oldest numbering included. */
  aliases: string[];
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
  /** One document must have one active integration, including after an extension reload. */
  private static readonly activeIntegrations = new WeakMap<Document, StudentCenterIntegration>();
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
  private readonly details = new Map<string, Professor>();
  /** Set while the card shows one professor's detail view rather than the list. */
  private activeProfessorId: string | null = null;
  private host: HTMLElement | null = null;
  /** Guards the row's focus handler while focus is restored after an Escape. */
  private suppressFocusOpen = false;
  /** Ignores focusout emitted when a card action replaces its focused button. */
  private suppressFocusHide = 0;
  private preferences: StudentPreferences;
  private favoriteIds: Set<string>;

  constructor(private readonly options: StudentCenterIntegrationOptions) {
    this.preferences = options.preferences ?? createDefaultPreferences();
    this.favoriteIds = new Set((options.favorites ?? []).map((favorite) => favorite.id));
  }

  start(): void {
    const existing = StudentCenterIntegration.activeIntegrations.get(this.options.document);
    if (existing && existing !== this) existing.stop();
    StudentCenterIntegration.activeIntegrations.set(this.options.document, this);
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
    if (StudentCenterIntegration.activeIntegrations.get(this.options.document) === this) {
      StudentCenterIntegration.activeIntegrations.delete(this.options.document);
    }
  }

  /** Re-renders an open card so a preference change is reflected immediately. */
  updatePreferences(preferences: StudentPreferences): void {
    this.preferences = preferences;
    if (this.activeRow) this.refresh(this.activeRow);
  }

  updateFavorites(favorites: FavoriteClass[]): void {
    this.favoriteIds = new Set(favorites.map((favorite) => favorite.id));
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
      if (this.suppressFocusOpen) return;
      this.clearManualDismissal();
      this.show(this.currentTarget(row), "focus");
    });
    row.element.addEventListener("blur", (event) => {
      // Tabbing into the card must not hide the thing being tabbed into.
      const next = (event as FocusEvent).relatedTarget;
      if (this.nodeIsInsideOpenCard(next)) return;
      this.scheduleHide();
    });
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

  /** Re-renders in place, keeping an open professor detail view open. */
  private refresh(row: HoverRow): void {
    const card = this.host?.shadowRoot?.querySelector<HTMLElement>(".card");
    if (!card) return;
    if (isCourseHoverRow(row)) {
      this.renderCourseList(card, this.resolveCourseRow(row));
      this.repositionOpenCard(row, card);
      return;
    }
    const resolved = this.resolveRow(row);
    const open = resolved.rated.find((professor) => professor.id === this.activeProfessorId);
    const showClose = row.source !== "shopping-cart";
    if (open) this.renderDetail(card, resolved, open, showClose);
    else this.renderList(card, resolved, showClose);
    this.repositionOpenCard(row, card);
  }

  private resolveCourseRow(row: CourseHoverRow): ResolvedCourseRow {
    return {
      row,
      comparisons: rankComparisons(
        buildCourseProfessorComparisons(row.instructors, this.options.professors, this.preferences),
      ),
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

      if (isCourseHoverRow(row)) {
        this.renderCourseList(card, this.resolveCourseRow(row));
      } else {
        const resolved = this.resolveRow(row);
        this.renderList(card, resolved, row.source !== "shopping-cart");
        void this.loadDetails(row, resolved);
      }
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
    this.activeProfessorId = null;
    this.activeRow = null;
    this.openMode = null;
  }

  private focusIsInsideCard(): boolean {
    return this.nodeIsInsideOpenCard(this.options.document.activeElement);
  }

  private nodeIsInsideOpenCard(node: EventTarget | null): boolean {
    if (!this.host || !(node instanceof Node)) return false;
    return node === this.host || this.host.contains(node) || this.host.shadowRoot?.contains(node) === true;
  }

  private firstFocusableInCard(): HTMLElement | null {
    const card = this.host?.shadowRoot?.querySelector(".card");
    return card?.querySelector<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])") ?? null;
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.activeRow) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const target = this.activeRow.element;
      const shouldRestoreFocus = this.focusIsInsideCard();
      this.dismissManually();
      if (shouldRestoreFocus) {
        // Returning focus to the row would otherwise re-trigger its focus
        // handler and reopen the card the student just dismissed.
        this.suppressFocusOpen = true;
        target.focus();
        this.suppressFocusOpen = false;
      }
      return;
    }

    // The card is appended to the end of the body, so it is nowhere near the
    // row in tab order. Bridge the two, otherwise the dialog is unreachable.
    if (event.key !== "Tab" || event.shiftKey || this.host?.hidden) return;
    if (this.options.document.activeElement !== this.activeRow.element) return;
    const first = this.firstFocusableInCard();
    if (!first) return;
    event.preventDefault();
    this.cancelHide();
    first.focus();
  };

  private handleDocumentPointerDown = (event: Event): void => {
    if (this.eventTargetsCloseControl(event)) {
      this.handleCloseEvent(event);
      return;
    }
    if (!this.activeRow || this.host?.hidden) return;
    const path = event.composedPath();
    if (this.eventTargetsOpenCard(event, path)) {
      // This listener runs during document capture, before a Shadow-DOM
      // button receives its own pointerdown/click. Keep the card alive now.
      this.retainCardForInteraction();
      return;
    }
    if (this.openMode !== "click" || path.includes(this.activeRow.element)) return;
    this.dismissManually();
  };

  /** Shadow-DOM events normally include the host, but checking the card too
   * keeps controls interactive if a host browser retargets the event path. */
  private eventTargetsOpenCard(event: Event, path: EventTarget[]): boolean {
    const card = this.host?.shadowRoot?.querySelector<HTMLElement>(".card");
    return Boolean(
      (this.host && (path.includes(this.host) || event.target === this.host))
      || (card && (path.includes(card) || event.target === card)),
    );
  }

  /** A card action turns a transient hover into an intentionally open card. */
  private retainCardForInteraction(): void {
    this.cancelHide();
    if (this.activeRow) this.openMode = "click";
  }

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

  private repositionOpenCard(row: HoverRow, card: HTMLElement): void {
    if (this.host && !this.host.hidden) this.positionCard(row, this.host, card);
  }

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

    // A max-height alone does not give a flex child a definite size. With a
    // long detail view that meant the review body could grow past the card
    // instead of becoming the scrollable region. Measure the natural card
    // first, then give it a concrete viewport-bounded height so `.body` can
    // take the remaining space and scroll internally.
    card.style.height = "auto";
    card.style.maxHeight = "none";
    const naturalRect = card.getBoundingClientRect();
    const naturalHeight = Math.max(card.scrollHeight, naturalRect.height);
    const boundedHeight = Math.min(Math.max(1, naturalHeight || maxHeight), maxHeight);
    card.style.maxHeight = `${maxHeight}px`;
    card.style.height = `${boundedHeight}px`;
    // The header stays visible; each rendered card body owns the review list's
    // internal scroll position so long detail views never escape the viewport.
    card.style.overflowY = "hidden";

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
    card.tabIndex = -1;
    card.addEventListener("pointerenter", () => this.cancelHide());
    // Cancels the target's pending hover dismissal before a button click is
    // delivered, including on pages that retarget Shadow-DOM pointer events.
    card.addEventListener("pointerdown", () => this.retainCardForInteraction());
    card.addEventListener("pointerleave", () => this.scheduleHide());
    host.addEventListener("focusin", () => this.cancelHide());
    host.addEventListener("focusout", (event) => {
      if (this.suppressFocusHide > 0) return;
      const next = (event as FocusEvent).relatedTarget;
      if (this.nodeIsInsideOpenCard(next) || next === this.activeRow?.element) return;
      this.scheduleHide();
    });
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

  /** Replacing focused action controls dispatches focusout in Chrome. */
  private clearCard(card: HTMLElement): void {
    this.suppressFocusHide += 1;
    card.replaceChildren();
    queueMicrotask(() => { this.suppressFocusHide -= 1; });
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

  private renderList(card: HTMLElement, resolved: ResolvedRow, showClose = true): void {
    this.activeProfessorId = null;
    this.clearCard(card);
    const count = resolved.rated.length + resolved.unratedNames.length;
    const courseCode = resolved.row.courseCode;
    const title = courseCode ? courseTitle(courseCode) : undefined;
    this.renderHead(
      card,
      courseCode ?? "Professor ratings",
      title ? `${title} • ${count} ${count === 1 ? "professor" : "professors"}` : `${count} ${count === 1 ? "professor" : "professors"}`,
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
      button.append(top);
      if (courseCode) {
        button.append(
          this.renderCourseLine(courseCode, scopeToCourse(professor, resolved.aliases), this.details.has(professor.id)),
        );
      }
      button.append(this.element("p", "fit", matchProfessor(professor, this.preferences).fitLine));
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.renderDetail(card, resolved, professor, showClose);
      });
      body.append(button);
    }

    for (const name of resolved.unratedNames) {
      body.append(this.element("p", "unrated", `${name} — no ratings available yet`));
    }

    const favoriteToggle = this.renderFavoriteToggle(resolved, card, showClose);
    if (favoriteToggle) body.append(favoriteToggle);

    body.append(this.renderSummary(resolved.rated, resolved.aliases));
    card.append(body);
  }

  /** Saves the hovered class, tagged with whichever professor currently ranks first. */
  private renderFavoriteToggle(
    resolved: ResolvedRow,
    card: HTMLElement,
    showClose: boolean,
  ): HTMLElement | null {
    const courseCode = resolved.row.courseCode;
    if (!courseCode) return null;

    const top = resolved.rated[0] ?? null;
    const id = favoriteId(courseCode, top?.id ?? null);
    const isSaved = this.favoriteIds.has(id);

    const button = this.element(
      "button",
      isSaved ? "favorite is-saved" : "favorite",
      isSaved ? `★ Saved — ${courseCode}` : `☆ Save ${courseCode}`,
    ) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("aria-pressed", String(isSaved));
    button.setAttribute(
      "aria-label",
      isSaved ? `Remove ${courseCode} from favorites` : `Save ${courseCode} to favorites`,
    );
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.retainCardForInteraction();
      if (isSaved) this.favoriteIds.delete(id);
      else this.favoriteIds.add(id);
      this.options.onToggleFavorite?.(
        {
          id,
          courseCode,
          courseTitle: courseTitle(courseCode) ?? null,
          professorId: top?.id ?? null,
          professorName: top?.name ?? null,
          starRating: top?.starRating ?? null,
          clarityRating: top?.clarityRating ?? null,
          savedAt: new Date().toISOString(),
        },
        !isSaved,
      );
      this.renderList(card, resolved, showClose);
    });
    return button;
  }

  private renderCourseList(card: HTMLElement, resolved: ResolvedCourseRow): void {
    this.clearCard(card);
    this.renderHead(
      card,
      resolved.row.course.code,
      resolved.row.course.title ?? "Course title unavailable in this view",
    );
    card.append(CourseHoverCard({
      document: this.options.document,
      course: resolved.row.course,
      comparisons: resolved.comparisons,
      recommendation: this.buildCourseRecommendation(resolved),
      onCompare: (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.retainCardForInteraction();
        this.renderCourseComparison(card, resolved);
      },
    }));
  }

  private renderCourseComparison(card: HTMLElement, resolved: ResolvedCourseRow): void {
    this.clearCard(card);
    this.renderHead(card, resolved.row.course.code, "Professor comparison");
    card.append(CourseProfessorComparisonView({
      document: this.options.document,
      comparisons: resolved.comparisons,
      onBack: (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.retainCardForInteraction();
        this.renderCourseList(card, resolved);
      },
    }));
  }

  /** Best-ranked resolvable professor for a course card, with its explanation. */
  private buildCourseRecommendation(resolved: ResolvedCourseRow): CourseHoverCardProps["recommendation"] {
    const matched = resolved.comparisons
      .map((comparison) => this.professorById(comparison.professorId))
      .filter((professor): professor is Professor => professor !== null);
    if (matched.length === 0) return null;

    const best = rankProfessors(matched, this.preferences)[0];
    const explanation = buildRecommendationExplanation(best, this.preferences);
    return {
      name: best.name,
      headline: explanation.headline,
      factors: describePreferenceFactors(best, this.preferences),
      caveat: explanation.caveat,
    };
  }

  private professorById(id: string | null): Professor | null {
    if (!id) return null;
    return this.details.get(id) ?? this.options.professors.find((professor) => professor.id === id) ?? null;
  }

  private renderSummary(professors: Professor[], aliases: string[]): HTMLElement {
    const summary = this.element("section", "summary");
    summary.append(
      this.element("h3", undefined, "Personalized summary"),
      this.element("p", undefined, buildClassSummary(professors, this.preferences)),
    );

    const best = rankProfessors(professors, this.preferences)[0];
    if (best) {
      const explanation = buildRecommendationExplanation(best, this.preferences, aliases);
      summary.append(
        this.element("p", "rec-basis", explanation.headline),
        this.element("p", "rec-factors", describePreferenceFactors(best, this.preferences)),
      );
      if (explanation.caveat) summary.append(this.element("p", "note caveat", explanation.caveat));
    }

    summary.append(
      this.element(
        "p",
        "note",
        `Fit is generated from your saved preferences; no AI model is used. Ratings and reviews come from PolyRatings, scored out of ${ratingScaleMax}.`,
      ),
    );
    return summary;
  }

  /** Themes, strengths, and concerns drawn from this professor's own review text. */
  private renderReviewSynthesis(professor: Professor, reviews: Professor["reviews"]): HTMLElement {
    const synthesis: ReviewSynthesis = synthesizeReviews(professor, reviews);
    const section = this.element("div", "detail-card synthesis");
    section.append(
      this.element("h3", undefined, "Review summary"),
      this.element("p", undefined, synthesis.overview),
    );

    if (synthesis.themes.length > 0) {
      section.append(this.element("p", "synthesis-label", "Common themes"));
      const themes = this.element("div", "tags");
      for (const theme of synthesis.themes) {
        const chip = this.element("span", `tag theme-${theme.sentiment}`, `${theme.topic} · ${theme.mentions}`);
        chip.title = `${theme.topic} mentioned in ${theme.mentions} ${theme.mentions === 1 ? "review" : "reviews"} (${theme.sentiment})`;
        themes.append(chip);
      }
      section.append(themes);
    }

    for (const group of [
      { label: "Strengths", items: synthesis.strengths, className: "synthesis-strength" },
      { label: "Concerns", items: synthesis.concerns, className: "synthesis-concern" },
    ]) {
      if (group.items.length === 0) continue;
      section.append(this.element("p", "synthesis-label", group.label));
      const list = this.element("ul", "synthesis-list");
      for (const item of group.items) list.append(this.element("li", group.className, item));
      section.append(list);
    }

    if (synthesis.strengths.length === 0 && synthesis.concerns.length === 0 && synthesis.reviewsAnalyzed > 0) {
      section.append(
        this.element("p", "note", "Reviewers did not agree often enough to list distinct strengths or concerns."),
      );
    }

    section.append(
      this.element(
        "p",
        "note",
        `Counted from the wording of ${synthesis.reviewsAnalyzed} PolyRatings ${synthesis.reviewsAnalyzed === 1 ? "review" : "reviews"}; no AI model is used.`,
      ),
    );
    return section;
  }

  private renderDetail(card: HTMLElement, resolved: ResolvedRow, professor: Professor, showClose = true): void {
    this.activeProfessorId = professor.id;
    this.clearCard(card);
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

    if (this.details.has(professor.id)) {
      body.append(this.renderReviewSynthesis(professor, ordered));
    }

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


export { normalizeInstructorName };

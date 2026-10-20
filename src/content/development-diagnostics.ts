/**
 * Development-only integration diagnostics. Set this false (or remove this
 * module) before a release. It records no page content or student data.
 */
export const ENABLE_DEVELOPMENT_DIAGNOSTICS = true;

export interface IntegrationDiagnostics {
  instructorFieldsFound(count: number): void;
  professorTargetsExtracted(count: number): void;
  surfaceTargetsFound(counts: { myScheduleMainRow: number; myScheduleExpandedDetail: number; scheduleBuilder: number }): void;
  hoverEventReceived(): void;
  hoverCardRendered(): void;
  renderingError(): void;
}

export class DevelopmentDiagnostics implements IntegrationDiagnostics {
  private readonly badge: HTMLElement;
  private instructorFieldCount: number | null = null;
  private professorTargetCount: number | null = null;
  private surfaceTargets: { myScheduleMainRow: number; myScheduleExpandedDetail: number; scheduleBuilder: number } | null = null;
  private status = "Script Loaded";

  constructor(private readonly document: Document) {
    document.getElementById("ai-polyratings-development-diagnostics")?.remove();
    this.badge = document.createElement("div");
    this.badge.id = "ai-polyratings-development-diagnostics";
    this.badge.style.cssText = "bottom:12px;position:fixed;right:12px;z-index:2147483647;";
    const shadow = this.badge.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>.badge{background:#1e3932;border:1px solid #d2a800;border-radius:7px;color:#fff;font:700 12px/1.35 system-ui,sans-serif;max-width:250px;padding:8px 10px}.detail{color:#fff1c4;font-weight:600;margin-top:2px}</style><div class="badge"><div>AI PolyRatings: Script Loaded</div><div class="detail"></div></div>`;
    document.body.append(this.badge);
    this.render();
    console.info("[AI PolyRatings diagnostics] content script loaded");
  }

  instructorFieldsFound(count: number): void {
    this.instructorFieldCount = count;
    this.render();
    console.info("[AI PolyRatings diagnostics] instructor field count updated");
  }

  professorTargetsExtracted(count: number): void { this.professorTargetCount = count; this.status = `${count} Professors Found`; this.render(); console.info("[AI PolyRatings diagnostics] professor target count updated"); }

  surfaceTargetsFound(counts: { myScheduleMainRow: number; myScheduleExpandedDetail: number; scheduleBuilder: number }): void {
    this.surfaceTargets = counts;
    this.render();
    console.info("[AI PolyRatings diagnostics] surface target counts updated");
  }

  hoverEventReceived(): void { this.status = "Hover Event Received"; this.render(); console.info("[AI PolyRatings diagnostics] hover event received"); }
  hoverCardRendered(): void { this.status = "Hover Card Rendered"; this.render(); console.info("[AI PolyRatings diagnostics] hover card rendered"); }
  renderingError(): void { this.status = "Rendering Error"; this.render(); console.error("[AI PolyRatings diagnostics] rendering error"); }

  private render(): void {
    const detail = this.badge.shadowRoot?.querySelector<HTMLElement>(".detail");
    if (!detail) return;
    const fields = this.instructorFieldCount === null ? "" : `${this.instructorFieldCount} Instructor Fields · `;
    const targets = this.professorTargetCount === null ? this.status : `${this.professorTargetCount} Professors Found · ${this.status}`;
    const surfaces = this.surfaceTargets === null ? "" : `Main ${this.surfaceTargets.myScheduleMainRow} · Details ${this.surfaceTargets.myScheduleExpandedDetail} · Builder ${this.surfaceTargets.scheduleBuilder} · `;
    detail.textContent = `${surfaces}${fields}${targets}`;
  }
}

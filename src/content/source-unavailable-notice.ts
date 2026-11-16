const hostId = "polyratings-unavailable-host";

const noticeStyles = `
:host { all: initial; }
.notice {
  background: #fdf3ee;
  border: 1px solid #e8c4b0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgb(30 61 47 / 22%);
  color: #1e3d2f;
  display: flex;
  font: 13px/1.45 Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  gap: 10px;
  max-width: 340px;
  padding: 12px 13px;
}
.body { min-width: 0; }
.title { font-size: 12.5px; font-weight: 700; margin: 0 0 3px; }
.text { color: #7c2d12; font-size: 12px; margin: 0; }
.dismiss {
  align-self: flex-start;
  background: none;
  border: 0;
  color: #7c2d12;
  cursor: pointer;
  font: 700 14px Inter, system-ui, sans-serif;
  line-height: 1;
  padding: 2px 4px;
}
.dismiss:focus-visible { outline: 2px solid #1e3d2f; outline-offset: 2px; }
`;

/**
 * Tells the student the ratings source failed, rather than leaving a page that
 * looks identical to one where the extension never ran. Never throws: a failure
 * here must not add a second fault on top of the one being reported.
 */
export function renderSourceUnavailableNotice(document: Document, error?: unknown): void {
  try {
    document.querySelectorAll(`#${hostId}`).forEach((existing) => existing.remove());

    const host = document.createElement("div");
    host.id = hostId;
    host.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = noticeStyles;

    const notice = document.createElement("div");
    notice.className = "notice";
    notice.setAttribute("role", "status");

    const body = document.createElement("div");
    body.className = "body";
    const title = document.createElement("p");
    title.className = "title";
    title.textContent = "PolyProf could not load ratings";
    const text = document.createElement("p");
    text.className = "text";
    text.textContent =
      "PolyRatings is unreachable right now, so professor cards are unavailable on this page. Your schedule is unaffected.";
    body.append(title, text);

    const dismiss = document.createElement("button");
    dismiss.className = "dismiss";
    dismiss.type = "button";
    dismiss.textContent = "✕";
    dismiss.setAttribute("aria-label", "Dismiss PolyProf notice");
    dismiss.addEventListener("click", () => host.remove());

    notice.append(body, dismiss);
    shadow.append(style, notice);
    document.body.append(host);

    if (error) console.warn("PolyProf: ratings source unavailable.", error);
  } catch {
    // The host page is more important than this notice.
  }
}

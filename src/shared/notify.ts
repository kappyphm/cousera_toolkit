// User-facing toast on the Coursera page (content-script context).
// Console logs are invisible to most users, so rate-limit retries and
// final failures are surfaced here. Notifications must never break the
// feature that triggered them — everything is wrapped defensively.

let toastEl: HTMLDivElement | null = null;
let hideTimer: number | undefined;

export function notifyUser(
  message: string,
  kind: "info" | "warn" | "error" = "info",
  durationMs = 8000
): void {
  try {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div");
      toastEl.id = "cousera-toolkit-notify";
      Object.assign(toastEl.style, {
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: "2147483647",
        maxWidth: "360px",
        padding: "10px 14px",
        borderRadius: "8px",
        color: "#fff",
        font: "13px/1.45 system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,.3)",
        cursor: "pointer"
      });
      toastEl.title = "Bấm để đóng";
      toastEl.addEventListener("click", () => {
        toastEl?.remove();
        toastEl = null;
      });
      document.documentElement.appendChild(toastEl);
    }
    toastEl.style.background =
      kind === "error" ? "#c62828" : kind === "warn" ? "#ef6c00" : "#0356fc";
    toastEl.textContent = message;
    window.clearTimeout(hideTimer);
    if (durationMs > 0) {
      hideTimer = window.setTimeout(() => {
        toastEl?.remove();
        toastEl = null;
      }, durationMs);
    }
  } catch {
    /* a failed toast must never fail the feature */
  }
}

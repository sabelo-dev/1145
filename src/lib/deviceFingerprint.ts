// Lightweight device fingerprint for anti-fraud logging.
// Not a security boundary — used only as a signal for admin review.
export async function getDeviceFingerprint(): Promise<string> {
  try {
    const parts = [
      navigator.userAgent,
      navigator.language,
      String(screen.width) + "x" + String(screen.height),
      String(screen.colorDepth),
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || "0",
    ];
    // Canvas fingerprint
    try {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 40;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 200, 40);
        ctx.fillStyle = "#069";
        ctx.fillText("1145-fp", 2, 2);
        parts.push(c.toDataURL().slice(-64));
      }
    } catch {
      /* ignore */
    }
    const buf = new TextEncoder().encode(parts.join("|"));
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "unavailable";
  }
}

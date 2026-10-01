import { getAppUrl } from "@/lib/appUrl";
import { isNative, openExternal } from "@/lib/native";

/** Hosts we are willing to post a payment form to from the /pay bridge. */
export const PAYFAST_PROCESS_URLS = [
  "https://www.payfast.co.za/eng/process",
  "https://sandbox.payfast.co.za/eng/process",
];

/**
 * Where PayFast sends the user afterwards. On the web: the page itself. In
 * the iOS / Android app the payment runs in the system browser, so it goes to
 * /app-return on 1145.io, which hands the user back to the app.
 */
export function paymentReturnUrl(path: string): string {
  if (!isNative()) return getAppUrl(path);
  return getAppUrl(`/app-return?to=${encodeURIComponent(path)}`);
}

const toBase64Url = (text: string) =>
  btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Send the user to PayFast with the signed form from payfast-payment.
 * Web: POST the form from this page. Native app: open 1145.io/pay in the
 * system browser, which posts the same form (field order and values intact,
 * so the signature still matches).
 */
export async function submitPayFastForm(action: string, formData: Record<string, unknown>) {
  if (!PAYFAST_PROCESS_URLS.includes(action)) throw new Error("Unexpected payment address");

  if (isNative()) {
    const payload = toBase64Url(JSON.stringify({ action, fields: Object.entries(formData) }));
    await openExternal(`${getAppUrl("/pay")}#${payload}`);
    return;
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";
  for (const [key, value] of Object.entries(formData)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value ?? "");
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

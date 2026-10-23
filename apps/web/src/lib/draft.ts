import {
  BUDGETS,
  SERVICE_TYPES,
  type LeadReceipt,
  type LeadInput,
} from "@azelvori/contracts";
const key = "azelvori:brief-preferences:v1";
// Only non-sensitive choices persist. Free text, email, names, URLs and bug logs NEVER enter localStorage.
export function loadPreferences(): Partial<LeadInput> {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !stored ||
      stored.expiresAt < Date.now() ||
      !Number.isFinite(stored.expiresAt)
    )
      return {};
    return {
      ...(SERVICE_TYPES.includes(stored.serviceType)
        ? { serviceType: stored.serviceType }
        : {}),
      ...(BUDGETS.includes(stored.budget) ? { budget: stored.budget } : {}),
    };
  } catch {
    return {};
  }
}
export function savePreferences(data: LeadInput) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        serviceType: data.serviceType,
        budget: data.budget,
        expiresAt: Date.now() + 7 * 86400000,
      }),
    );
  } catch {
    /* storage can be unavailable in private mode */
  }
}
export function clearPreferences() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* optional persistence */
  }
}
export function exportBrief(data: LeadInput, receipt?: LeadReceipt) {
  const { website: _honeypot, ...brief } = data;
  const blob = new Blob(
    [
      JSON.stringify(
        {
          schemaVersion: 1,
          status: receipt ? "RECEIVED" : "LOCAL_DRAFT_NOT_SUBMITTED",
          ...(receipt ? { receipt } : {}),
          ...brief,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "azelvori-brief-draft.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

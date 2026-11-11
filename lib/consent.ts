export type ConsentChoice = "accepted" | "declined";

const CONSENT_KEY = "privacy_consent_v1";
const ANALYTICS_SESSION_KEY = "analytics_session_id";
export const CONSENT_OPEN_EVENT = "privacy-consent:open";

export function getConsent(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
    if (choice === "declined") localStorage.removeItem(ANALYTICS_SESSION_KEY);
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): a escolha vale só nesta visita.
  }
}

export function openConsentPreferences(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

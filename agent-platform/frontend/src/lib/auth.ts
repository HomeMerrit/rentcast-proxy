const KEY = "agentos_api_key";
const ORG = "agentos_org_name";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function isAuthed(): boolean {
  return !!getApiKey();
}

export function getWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG);
}

export function setApiKey(key: string, orgName?: string): void {
  localStorage.setItem(KEY, key);
  if (orgName) localStorage.setItem(ORG, orgName);
  // Non-HttpOnly cookie so the edge middleware can gate routes before hydration.
  document.cookie = `api_key=${key}; path=/; SameSite=Strict`;
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(ORG);
  document.cookie = "api_key=; path=/; max-age=0";
}

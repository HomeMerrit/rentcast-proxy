const KEY = "agentos_api_key";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY, key);
  document.cookie = `api_key=${key}; path=/; SameSite=Strict`;
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY);
  document.cookie = "api_key=; path=/; max-age=0";
}

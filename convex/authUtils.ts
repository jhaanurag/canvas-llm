export function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}

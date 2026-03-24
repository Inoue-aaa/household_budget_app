export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeRuleToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

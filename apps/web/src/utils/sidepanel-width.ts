// This module handles persisted sidepanel width rules and local storage access.
const SIDEPANEL_STORAGE_KEY = "phpsage.sidepanel.width";

export function clampSidepanelWidth(
  value: number,
  maxAllowedByViewport: number,
  minWidth: number,
  maxWidth: number
): number {
  const max = Math.max(minWidth, Math.min(maxWidth, maxAllowedByViewport));
  return Math.min(Math.max(value, minWidth), max);
}

export function loadSidepanelWidth(defaultWidth: number, minWidth: number, maxWidth: number): number {
  const rawValue = window.localStorage.getItem(SIDEPANEL_STORAGE_KEY);
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;
  const maxAllowedByViewport = Math.floor(window.innerWidth * 0.55);

  if (Number.isNaN(parsedValue)) {
    return clampSidepanelWidth(defaultWidth, maxAllowedByViewport, minWidth, maxWidth);
  }

  return clampSidepanelWidth(parsedValue, maxAllowedByViewport, minWidth, maxWidth);
}

export function saveSidepanelWidth(width: number): void {
  window.localStorage.setItem(SIDEPANEL_STORAGE_KEY, String(width));
}

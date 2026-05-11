export const SCREEN_HORIZONTAL_PADDING = 12;
export const BOTTOM_SAFE_GUTTER = 12;
export const MIN_BOTTOM_INSET = 8;

export function getBottomSafePadding(bottomInset: number, extra = 0) {
  return Math.max(bottomInset, MIN_BOTTOM_INSET) + BOTTOM_SAFE_GUTTER + extra;
}

export function getFloatingBottomOffset(bottomInset: number, extra = 0) {
  return Math.max(bottomInset, MIN_BOTTOM_INSET) + extra;
}

export interface WindowMetrics { windowWidth: number; windowHeight: number; safeArea?: { left: number; right: number; top: number; bottom: number } }
export function mobileLayout(info: WindowMetrics, capsule?: { bottom: number }) {
  const height = 540, width = Math.round(height * info.windowWidth / info.windowHeight);
  const scale = Math.min(info.windowWidth / width, info.windowHeight / height);
  const offsetX = (info.windowWidth - width * scale) / 2, offsetY = (info.windowHeight - height * scale) / 2;
  const safe = info.safeArea ?? { left: 0, top: 0, right: info.windowWidth, bottom: info.windowHeight };
  const left = Math.max(16, (safe.left - offsetX) / scale + 16);
  const right = Math.min(width - 16, (safe.right - offsetX) / scale - 16);
  const top = Math.max(16, (safe.top - offsetY) / scale + 16);
  const bottom = Math.min(height - 16, (safe.bottom - offsetY) / scale - 16);
  const rightTop = Math.max(top, ((capsule?.bottom ?? 0) - offsetY) / scale + 12);
  return { width, height, scale, offsetX, offsetY, left, right, top, bottom, rightTop };
}

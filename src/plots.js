/**
 * Shared canvas instruments for the two-dimensional scientific views.
 * A single helper owns DPR sizing and resize observation so each page only
 * has to describe its data, not repeat canvas plumbing.
 */

export const PLATE_INK = "#eaf3ff";
export const PLATE_MUTED = "#93a9c0";
export const PLATE_FAINT = "#61788e";
export const PLATE_RULE = "#253546";
export const PLATE_LINE = "#8fc0f5";
export const PLATE_BARRIER = "#9cc7fa";

/* The two data blues used by every scientific mark. */
export const DATA_LIGHT = "#a9d3ff";
export const DATA_DEEP = "#3f7fd9";
export const DATA_PALE = "#dcecff";

export const PLOT_FONT = '"IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace';

export function mono(ctx, size = 8, color = PLATE_MUTED, weight = 400) {
  ctx.font = `${weight} ${size}px ${PLOT_FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
}

export function rule(ctx, x1, y1, x2, y2, color = PLATE_RULE, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function withAlpha(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean,
    16
  );
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create a canvas that fills a positioned host, at up to 2x DPR.
 * Returned coordinates are CSS pixels, so plot code can use layout numbers
 * directly.
 */
export function createOverlayCanvas(host, className = "plot-canvas") {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let width = 1;
  let height = 1;
  let resizeHandler = null;

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // A hidden host measures 0×0. Keep the last real backing size instead of
    // collapsing the canvas to 1×1 and erasing the previous plot.
    if (rect.width < 2 || rect.height < 2) {
      return { width, height, dpr };
    }
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  };

  const observer = new ResizeObserver(() => {
    const size = resize();
    resizeHandler?.(size);
  });
  observer.observe(host);
  resize();

  return {
    canvas,
    ctx,
    resize,
    onResize(handler) {
      resizeHandler = handler;
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    dispose() {
      observer.disconnect();
      canvas.remove();
    },
  };
}

/** Plot area with the plate frame and quiet axis rules. */
export function drawPlotFrame(ctx, area) {
  ctx.fillStyle = "#080d14";
  ctx.fillRect(area.x, area.y, area.w, area.h);
  rule(ctx, area.x, area.y + area.h, area.x + area.w, area.y + area.h, PLATE_RULE);
  rule(ctx, area.x, area.y, area.x, area.y + area.h, PLATE_RULE);
}

/** Small upper-left caption used by the plate instruments. */
export function drawCaption(ctx, text, x, y, color = PLATE_MUTED) {
  mono(ctx, 8.5, color, 500);
  ctx.textAlign = "left";
  ctx.fillText(text.toUpperCase(), x, y);
}

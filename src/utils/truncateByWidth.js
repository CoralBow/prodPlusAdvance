export function truncateByWidth(text, font, maxWidth) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;

  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (
    truncated.length > 0 &&
    ctx.measureText(truncated + "…").width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + "…";
}

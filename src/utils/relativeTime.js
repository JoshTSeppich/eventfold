export function relativeTime(isoString) {
  if (!isoString) return "";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;

  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (diff < 60_000)     return "just now";
  if (mins  < 60)        return `${mins}m`;
  if (hours < 24)        return `${hours}h`;
  if (days  === 1)       return "1d";
  return `${days}d`;
}

export function fullDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

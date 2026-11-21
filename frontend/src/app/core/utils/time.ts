/** Temps restant avant une échéance (heures, minutes), ou null si elle est passée. */
export function remaining(iso: string, now = Date.now()): { h: number; m: number } | null {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000) };
}

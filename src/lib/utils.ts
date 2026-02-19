export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === 'string') return c;
      return Object.entries(c).filter(([, v]) => v).map(([k]) => k);
    })
    .filter(Boolean)
    .join(' ');
}

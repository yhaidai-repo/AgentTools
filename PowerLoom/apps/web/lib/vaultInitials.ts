// A vault's two initials for its tile: work-projects → WP, adoa → AD.
export function vaultInitials(vault: string): string {
  const words = vault.split(/[-_\s]+/).filter((word) => word.length > 0);
  const initials = words.length > 1 ? words[0][0] + words[1][0] : vault.slice(0, 2);

  return initials.toUpperCase();
}

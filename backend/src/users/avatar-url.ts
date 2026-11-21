/** URL publique de la photo d'un compte (relative à /api), ou null s'il n'en a pas. */
export function avatarUrl(user: { id: string; avatarVersion?: number } | null | undefined): string | null {
  return user && user.avatarVersion ? `/users/${user.id}/avatar?v=${user.avatarVersion}` : null;
}

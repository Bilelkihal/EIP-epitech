/** Lowercase ASCII with dashes. Accents are decomposed and stripped, so
 *  « Équipe Café » becomes "equipe-cafe" rather than a row of escapes. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return base || "equipe";
}

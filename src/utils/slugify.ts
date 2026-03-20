export function slugify(title: string): string {
  return title
    .normalize('NFD') // decompose accented chars (è → e + combining accent)
    .replace(/[\u0300-\u036f]/g, '') // remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/\s+/g, '-') // spaces to dashes
    .replace(/--+/g, '-') // collapse multiple dashes
}

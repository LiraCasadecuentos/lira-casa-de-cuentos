// Ayudas para textos: búsquedas sin importar tildes ni mayúsculas.

/** "Árbol GENEALÓGICO" -> "arbol genealogico" */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿El texto de búsqueda coincide con alguno de los campos?
 * Cada palabra buscada tiene que aparecer en algún lado ("dino arg" encuentra
 * "Mapa Dinosaurios de Argentina").
 */
export function matchesSearch(query, fields) {
  const q = normalize(query);
  if (!q) return true;
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return q.split(' ').every((word) => haystack.includes(word));
}

/** "Edad recomendada" -> "edad_recomendada" (para claves internas). */
export function slugify(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo';
}

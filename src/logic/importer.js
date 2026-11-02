// Lógica del asistente de importación desde Excel / CSV.
// No supone nombres de columnas fijos: intenta adivinar cada columna por su
// título, y después la persona puede corregir la asignación a mano.
// Todo esto es "puro" (no toca la base de datos) para poder probarlo fácil.

import { parseNumber, cents } from './money.js';
import { normalize } from './text.js';

/** Campos a los que se puede asignar una columna del archivo. */
export const IMPORT_FIELDS = [
  { key: 'ignore', label: '— No usar esta columna —' },
  { key: 'name', label: 'Nombre o título', synonyms: ['nombre', 'titulo', 'descripcion', 'detalle', 'producto', 'articulo', 'descrip'] },
  { key: 'code', label: 'Código del proveedor / ISBN', synonyms: ['codigo', 'cod', 'isbn', 'sku', 'ref', 'referencia', 'cod art', 'articulo nro'] },
  { key: 'qty', label: 'Cantidad (stock inicial)', synonyms: ['cantidad', 'cant', 'unidades', 'unid', 'qty', 'stock', 'stock inicial'] },
  { key: 'unitCost', label: 'Costo unitario', synonyms: ['costo unitario', 'precio unitario', 'p unit', 'p. unit', 'unitario', 'costo', 'precio neto', 'neto unitario', 'importe unitario', 'precio'] },
  { key: 'listPrice', label: 'PVP (precio de lista)', synonyms: ['pvp', 'p.v.p', 'precio de lista', 'lista', 'precio venta publico', 'precio al publico'] },
  { key: 'discount', label: 'Descuento del proveedor (%)', synonyms: ['descuento', 'dto', 'desc', 'bonif', 'bonificacion', '% dto'] },
  { key: 'salePrice', label: 'Precio de venta', synonyms: ['precio de venta', 'venta', 'precio final'] },
  { key: 'stockMin', label: 'Stock mínimo', synonyms: ['stock minimo', 'minimo'] },
  { key: 'category', label: 'Categoría', synonyms: ['categoria', 'rubro', 'tipo'] },
  { key: 'supplier', label: 'Proveedor', synonyms: ['proveedor', 'distribuidor'] },
  // Una sola columna que en los libros es la editorial y en los juegos la marca.
  { key: 'publisherOrBrand', label: 'Editorial o marca (según la categoría)', synonyms: ['editorial o marca', 'marca o editorial', 'editorial / marca', 'marca / editorial'] },
  { key: 'extra:autor', label: 'Autor', synonyms: ['autor', 'autora', 'autores'] },
  { key: 'extra:editorial', label: 'Editorial', synonyms: ['editorial', 'sello'] },
  { key: 'extra:genero', label: 'Género', synonyms: ['genero'] },
  { key: 'extra:coleccion', label: 'Colección', synonyms: ['coleccion', 'serie'] },
  { key: 'extra:marca', label: 'Marca', synonyms: ['marca', 'fabricante'] },
  { key: 'extra:edad_recomendada', label: 'Edad recomendada', synonyms: ['edad', 'edad recomendada'] },
  { key: 'extra:categoria_de_juego', label: 'Categoría de juego', synonyms: ['categoria de juego', 'tipo de juego'] },
  { key: 'extra:isbn', label: 'ISBN', synonyms: [] },
  { key: 'extra:codigo_de_barras', label: 'Código de barras', synonyms: ['codigo de barras', 'ean', 'barras'] },
  { key: 'notes', label: 'Notas', synonyms: ['notas', 'observaciones', 'obs', 'para revisar', 'revisar'] },
];

/** Columnas de la plantilla descargable (coinciden con los sinónimos de arriba). */
export const TEMPLATE_HEADERS = [
  'Nombre', 'Categoría', 'Proveedor', 'Código', 'Cantidad', 'Costo unitario', 'PVP',
  'Descuento', 'Precio de venta', 'Stock mínimo', 'Autor', 'Editorial', 'Género',
  'Colección', 'Marca', 'Edad recomendada', 'Categoría de juego', 'Notas',
];

const SKIP_ROW_WORDS = ['total', 'subtotal', 'iva', 'neto gravado', 'importe total', 'son pesos'];
// Filas sin nombre que tienen alguna de estas palabras son totales o resúmenes, no productos.
const SUMMARY_ROW = /\b(total|subtotal|valor del stock|control)\b/i;

function cellText(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Puntaje de qué tan bien un título de columna coincide con un campo. */
function scoreHeader(header, field) {
  const h = normalize(header).replace(/[.:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!h || !field.synonyms) return 0;
  let best = 0;
  for (const syn of field.synonyms) {
    const s = normalize(syn).replace(/[.:]/g, ' ').trim();
    if (h === s) best = Math.max(best, 3);
    else if (h.startsWith(s) || h.endsWith(s)) best = Math.max(best, 2);
    else if (h.includes(s)) best = Math.max(best, 1);
  }
  return best;
}

/** Cuántas celdas de una fila parecen títulos de columna conocidos. */
function headerHits(row) {
  let hits = 0;
  for (const cell of row || []) {
    if (typeof cell !== 'string') continue;
    if (IMPORT_FIELDS.some((f) => scoreHeader(cell, f) >= 2)) hits++;
  }
  return hits;
}

/** Busca la fila de títulos: la primera (de las 30 primeras) con al menos 2 títulos reconocibles. */
export function findHeaderRow(rows) {
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    if (headerHits(rows[i]) >= 2) return i;
  }
  const firstNonEmpty = rows.findIndex((r) => (r || []).some((c) => cellText(c) !== ''));
  return Math.max(0, firstNonEmpty);
}

/**
 * Si el archivo tiene varias hojas (por ejemplo "Leeme", "Productos", "Compras"),
 * elige la que más parece una lista de productos. Ante la duda, gana la que se llama "Productos".
 */
export function pickBestSheet(sheets) {
  let best = 0;
  let bestScore = -1;
  sheets.forEach((sheet, i) => {
    const rows = sheet.rows || [];
    let score = headerHits(rows[findHeaderRow(rows)]);
    if (/producto/i.test(sheet.name)) score += 2;
    if (rows.length < 2) score = -1;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** Adivina a qué campo corresponde cada columna. Devuelve un array con una clave por columna. */
export function guessMapping(headers) {
  const used = new Set();
  const result = headers.map(() => 'ignore');
  // Probamos primero las coincidencias más fuertes para no "gastar" un campo en una columna dudosa.
  const candidates = [];
  headers.forEach((header, col) => {
    for (const field of IMPORT_FIELDS) {
      const score = scoreHeader(cellText(header), field);
      if (score > 0) candidates.push({ col, key: field.key, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (result[c.col] !== 'ignore' || used.has(c.key)) continue;
    result[c.col] = c.key;
    used.add(c.key);
  }
  return result;
}

/** Descuento: acepta "35 %", 35 o 0,35 (como lo guarda Excel cuando la celda es porcentaje). */
export function parseDiscount(value) {
  const n = parseNumber(value);
  if (n === null) return null;
  if (n > 0 && n < 1) return cents(n * 100);
  return n;
}

/** Separa "El bosque (Colección Pequeños)" en { name: "El bosque", collection: "Colección Pequeños" }. */
export function splitCollection(title) {
  const m = String(title).match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!m || !m[1].trim()) return { name: String(title).trim(), collection: '' };
  return { name: m[1].trim(), collection: m[2].trim() };
}

/** Lee una fila del archivo con la asignación de columnas elegida. */
function readRow(row, mapping) {
  const out = { extras: {} };
  mapping.forEach((key, col) => {
    if (key === 'ignore') return;
    const value = row[col];
    if (key.startsWith('extra:')) {
      const t = cellText(value);
      if (t) out.extras[key.slice(6)] = t;
    } else {
      out[key] = value;
    }
  });
  return out;
}

/**
 * Arma la vista previa de la importación.
 * @param rows          filas del archivo (arrays de celdas)
 * @param headerRow     índice de la fila de títulos
 * @param mapping       clave de campo por columna
 * @param options       { splitCollection, defaultCategory, defaultSupplier }
 * @param existing      productos que ya están cargados (para detectar repetidos)
 * @returns { items, skipped }
 */
export function buildImportPlan({ rows, headerRow, mapping, options = {}, existing = [] }) {
  const groups = new Map();
  const skipped = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const raw = rows[i] || [];
    if (!raw.some((c) => cellText(c) !== '')) continue;
    const r = readRow(raw, mapping);
    const rowNumber = i + 1; // como lo ve la persona en Excel

    let name = cellText(r.name);
    const nName = normalize(name);
    if (!name && raw.some((c) => SUMMARY_ROW.test(normalize(cellText(c))))) {
      skipped.push({ rowNumber, reason: 'Parece una fila de totales' });
      continue;
    }
    if (nName && SKIP_ROW_WORDS.some((w) => nName === w || nName.startsWith(`${w} `) || nName.startsWith(`${w}:`))) {
      skipped.push({ rowNumber, reason: 'Parece una fila de totales' });
      continue;
    }

    const extras = { ...r.extras };
    if (options.splitCollection && name) {
      const split = splitCollection(name);
      name = split.name;
      if (split.collection && !extras.coleccion) extras.coleccion = split.collection;
    }

    const code = cellText(r.code).replace(/\.0+$/, '');
    const qtyRaw = r.qty;
    const qty = parseNumber(qtyRaw);
    const unitCost = parseNumber(r.unitCost);
    const listPrice = parseNumber(r.listPrice);
    const discount = parseDiscount(r.discount);
    const salePrice = parseNumber(r.salePrice);
    const stockMin = parseNumber(r.stockMin);

    const errors = [];
    const warnings = [];
    if (!name) errors.push('Falta el nombre');
    if (cellText(qtyRaw) !== '' && qty === null) errors.push(`La cantidad "${cellText(qtyRaw)}" no es un número`);
    if (qty !== null && qty < 0) errors.push('La cantidad es negativa');
    if (cellText(r.unitCost) !== '' && unitCost === null) errors.push(`El costo "${cellText(r.unitCost)}" no es un número`);

    // Componentes (por ejemplo "lámina" o "caja" de un mapa): sin precio. No se cargan como productos.
    const noPrice = !unitCost && !listPrice && !salePrice;
    const looksLikeComponent = !!name && noPrice && mapping.some((k) => k === 'unitCost' || k === 'listPrice');

    const groupKey = code ? `code:${code}` : `name:${normalize(name)}|${i}`;
    const prev = groups.get(groupKey);
    if (prev && !looksLikeComponent && !prev.looksLikeComponent) {
      // Mismo código en dos líneas: se suman en un solo producto.
      const prevQty = prev.qty || 0;
      const addQty = qty || 0;
      if (unitCost !== null && prev.unitCost !== null && unitCost !== prev.unitCost && prevQty + addQty > 0) {
        prev.unitCost = cents((prev.unitCost * prevQty + unitCost * addQty) / (prevQty + addQty));
        prev.warnings.push('Las líneas tenían costos distintos: se usa el promedio');
      }
      prev.qty = prevQty + addQty;
      prev.sourceRows.push(rowNumber);
      prev.errors.push(...errors);
      if (!prev.warnings.includes('Aparecía en varias líneas: se sumaron')) prev.warnings.push('Aparecía en varias líneas: se sumaron');
      continue;
    }

    groups.set(prev ? `${groupKey}|${i}` : groupKey, {
      key: `fila-${rowNumber}`,
      sourceRows: [rowNumber],
      include: !looksLikeComponent,
      looksLikeComponent,
      name,
      code,
      qty: qty ?? 0,
      unitCost,
      listPrice,
      discount,
      salePrice,
      stockMin,
      notes: cellText(r.notes),
      publisherOrBrand: cellText(r.publisherOrBrand),
      category: cellText(r.category) || options.defaultCategory || '',
      supplier: cellText(r.supplier) || options.defaultSupplier || '',
      extras,
      errors,
      warnings,
      matchId: null,
    });
  }

  const items = [...groups.values()];

  // Repetidos contra lo que ya está cargado: por código, y si no hay código, por nombre.
  const byCode = new Map();
  const byName = new Map();
  for (const p of existing) {
    if (p.deleted) continue;
    if (p.code) byCode.set(String(p.code).trim(), p);
    byName.set(normalize(p.name), p);
  }
  for (const item of items) {
    const match = (item.code && byCode.get(item.code)) || (!item.code && byName.get(normalize(item.name)));
    if (match) {
      item.matchId = match.id;
      item.warnings.push(`Ya existe "${match.name}": se suma al stock y se actualiza el costo`);
    }
    if (item.looksLikeComponent) item.warnings.push('Sin precio: parece un componente. No se carga (podés marcarlo si querés)');
    if (item.include && !item.unitCost && !item.listPrice) item.warnings.push('No tiene costo');
    if (item.include && !item.looksLikeComponent && !item.salePrice && !item.listPrice && item.unitCost) {
      item.warnings.push('Sin precio de venta: se usa el sugerido (costo + recargo)');
    }
  }

  return { items, skipped };
}

/**
 * Para cada línea, decide cómo se calcula el precio:
 * - Si tiene PVP: precio de lista con descuento (como las editoriales). Si falta
 *   el descuento pero hay costo unitario, el descuento se deduce.
 * - Si no: recargo sobre el costo.
 */
export function pricingFromItem(item) {
  if (item.listPrice) {
    let discount = item.discount;
    if ((discount === null || discount === undefined) && item.unitCost) {
      discount = cents((1 - item.unitCost / item.listPrice) * 100);
    }
    return { pricingMode: 'lista', listPrice: item.listPrice, supplierDiscount: discount ?? 0, baseCost: null };
  }
  return { pricingMode: 'recargo', baseCost: item.unitCost ?? 0, listPrice: null, supplierDiscount: null };
}

/** Nombres de los proveedores que aparecen en las líneas a importar (sin repetir). */
export function suppliersInPlan(items) {
  const seen = new Map();
  for (const i of items) {
    if (!i.include || i.errors.length || !i.supplier) continue;
    const key = normalize(i.supplier);
    if (!seen.has(key)) seen.set(key, i.supplier);
  }
  return [...seen.values()];
}

/**
 * "Editorial o marca" va al dato que tenga la categoría: editorial en los libros,
 * marca en los juegos. Si la categoría no tiene ninguno de los dos, se guarda como editorial.
 */
export function placePublisherOrBrand(extras, value, categoryFields = []) {
  if (!value) return extras;
  const keys = categoryFields.map((f) => f.key);
  const target = keys.includes('editorial') ? 'editorial' : keys.includes('marca') ? 'marca' : 'editorial';
  if (extras[target]) return extras;
  return { ...extras, [target]: value };
}

/** Resumen para mostrar antes de confirmar. */
export function summarizePlan(items) {
  // Las líneas con errores no se importan, así que no se cuentan.
  const included = items.filter((i) => i.include);
  const ok = included.filter((i) => i.errors.length === 0);
  return {
    products: ok.length,
    units: ok.reduce((s, i) => s + (Number(i.qty) || 0), 0),
    newProducts: ok.filter((i) => !i.matchId).length,
    existingProducts: ok.filter((i) => i.matchId).length,
    withErrors: included.length - ok.length,
  };
}

// Unión de respaldos.
//
// Cada registro tiene un ID único (UUID), fecha de creación (createdAt) y de
// última modificación (updatedAt). Al importar un respaldo:
//   - Si el ID no existe acá, se agrega.
//   - Si existe, se queda la versión modificada más recientemente.
//   - Nada se borra de verdad: los borrados son registros con deleted = true,
//     así el borrado también "viaja" en los respaldos.
// De esta forma nunca se duplican ni se pisan ventas.

/** Fecha de última modificación de un registro, como número para comparar. */
function stamp(record) {
  return Date.parse(record.updatedAt || record.createdAt || 0) || 0;
}

/**
 * Une dos listas de registros de una misma tabla.
 * Devuelve { records, added, updated, unchanged } donde records son los que
 * hay que guardar (nuevos o más recientes).
 */
export function mergeRecords(localRecords, incomingRecords) {
  const local = new Map(localRecords.map((r) => [r.id, r]));
  const toSave = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const incoming of incomingRecords) {
    if (!incoming || !incoming.id) continue;
    const existing = local.get(incoming.id);
    if (!existing) {
      toSave.push(incoming);
      local.set(incoming.id, incoming);
      added++;
    } else if (stamp(incoming) > stamp(existing)) {
      toSave.push(incoming);
      local.set(incoming.id, incoming);
      updated++;
    } else {
      unchanged++;
    }
  }
  return { records: toSave, added, updated, unchanged };
}

/** Une todas las tablas de un respaldo. Las dos entradas son { tabla: [registros] }. */
export function mergeBackup(localTables, incomingTables, tableNames) {
  const result = {};
  for (const name of tableNames) {
    result[name] = mergeRecords(localTables[name] || [], incomingTables[name] || []);
  }
  return result;
}

/**
 * Productos que parecen repetidos (mismo código, o mismo nombre sin código) pero con distinto id.
 * Pasa si dos dispositivos cargaron el mismo producto por separado.
 * Devuelve grupos: [[producto, producto], ...]
 */
export function findDuplicateProducts(products, normalize) {
  const groups = new Map();
  for (const p of products) {
    if (p.deleted) continue;
    const key = p.code ? `code:${String(p.code).trim()}` : `name:${normalize(p.name)}`;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Revisa que un archivo de respaldo tenga la forma correcta. Devuelve un mensaje de error amable o null. */
export function validateBackup(data, appId) {
  if (!data || typeof data !== 'object') return 'El archivo no parece un respaldo de la app.';
  if (data.app !== appId) return 'Este archivo no es un respaldo de Lira. Casa de cuentos.';
  if (!data.tables || typeof data.tables !== 'object') return 'El respaldo está incompleto o dañado.';
  return null;
}

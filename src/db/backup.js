// Respaldos: exportar todo a un archivo, importar uniendo con lo que ya hay,
// y borrar todos los datos.

import { db, SYNC_TABLES, APP_ID, BACKUP_VERSION } from './db.js';
import { getDevice, updateDevice, ensureDefaults } from './repo.js';
import { mergeBackup, validateBackup } from '../logic/merge.js';
import { nowIso, todayIso } from './ids.js';
import { downloadBlob } from '../ui/download.js';

/** Arma el contenido del respaldo (todas las tablas, incluidos los borrados). */
export async function buildBackup() {
  const device = await getDevice();
  const tables = {};
  for (const name of SYNC_TABLES) tables[name] = await db[name].toArray();
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    deviceId: device.deviceId,
    deviceName: device.deviceName || '',
    tables,
  };
}

/** Descarga el respaldo como archivo .json y anota la fecha. */
export async function exportBackup() {
  const data = await buildBackup();
  const device = await getDevice();
  const who = device.deviceName ? `-${device.deviceName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}` : '';
  const filename = `lira-respaldo${who}-${todayIso()}.json`;
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), filename);
  await updateDevice({ lastBackupAt: nowIso() });
  return filename;
}

/** Lee un archivo de respaldo. Devuelve el objeto o tira un error con un mensaje amable. */
export async function readBackupFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('No se pudo leer el archivo. ¿Es un respaldo de la app (termina en .json)?');
  }
  const problem = validateBackup(data, APP_ID);
  if (problem) throw new Error(problem);
  if (data.version > BACKUP_VERSION) {
    throw new Error('Este respaldo es de una versión más nueva de la app. Actualizá la app (cerrala y volvé a abrirla con internet) e intentá de nuevo.');
  }
  return data;
}

/**
 * Une un respaldo con los datos de este dispositivo. No duplica ni pisa:
 * agrega lo nuevo y, si un mismo registro cambió, se queda con el más reciente.
 * Devuelve un resumen por tabla.
 */
export async function importBackup(data) {
  const local = {};
  for (const name of SYNC_TABLES) local[name] = await db[name].toArray();
  const merged = mergeBackup(local, data.tables, SYNC_TABLES);
  await db.transaction('rw', SYNC_TABLES.map((n) => db[n]), async () => {
    for (const name of SYNC_TABLES) {
      if (merged[name].records.length) await db[name].bulkPut(merged[name].records);
    }
  });
  await updateDevice({ lastImportAt: nowIso() });
  const summary = {};
  for (const name of SYNC_TABLES) {
    summary[name] = { added: merged[name].added, updated: merged[name].updated };
  }
  return summary;
}

/** Borra TODO lo de este dispositivo (no toca los respaldos ya descargados). */
export async function eraseAllData() {
  await db.transaction('rw', SYNC_TABLES.map((n) => db[n]), async () => {
    for (const name of SYNC_TABLES) await db[name].clear();
  });
  await ensureDefaults();
}

/** Días desde el último respaldo (null si nunca se hizo). */
export function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86400000);
}

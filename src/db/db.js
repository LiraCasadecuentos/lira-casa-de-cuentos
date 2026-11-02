// Base de datos local (IndexedDB, a través de la librería Dexie).
// Todo queda guardado en el propio dispositivo: no hace falta internet ni servidor.
//
// Reglas que siguen todas las tablas que viajan en los respaldos:
//   id         identificador único (UUID o un id fijo para registros de base)
//   createdAt  fecha de creación (texto ISO)
//   updatedAt  fecha de última modificación (texto ISO)
//   deleted    true si se borró (no se borra de verdad, para que el borrado viaje en los respaldos)
//   deviceId   qué dispositivo hizo el último cambio
// Esto deja todo listo para sumar, más adelante, una sincronización en la nube.

import Dexie from 'dexie';

export const db = new Dexie('lira-casa-de-cuentos');

db.version(1).stores({
  settings: 'id',
  categories: 'id, name',
  suppliers: 'id, name',
  products: 'id, name, categoryId, supplierId, code',
  stockMoves: 'id, productId, type, refId, date',
  purchases: 'id, supplierId, date',
  priceHistory: 'id, productId, date',
  // Tablas que se usan en las próximas etapas (ventas, caja, gastos).
  sales: 'id, date',
  cashSessions: 'id, date',
  cashMoves: 'id, date',
  expenses: 'id, date',
  // Datos propios de este dispositivo. NO viajan en los respaldos.
  device: 'key',
});

/** Tablas que se exportan, importan y (en el futuro) se sincronizan. */
export const SYNC_TABLES = [
  'settings',
  'categories',
  'suppliers',
  'products',
  'stockMoves',
  'purchases',
  'priceHistory',
  'sales',
  'cashSessions',
  'cashMoves',
  'expenses',
];

export const APP_ID = 'lira-casa-de-cuentos';
export const BACKUP_VERSION = 1;

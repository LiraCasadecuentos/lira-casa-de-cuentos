// Datos que usan varias pantallas. useLiveQuery hace que la pantalla se
// actualice sola cuando cambian los datos.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { getSettings, getDevice } from '../db/repo.js';
import { computeStockMap } from '../logic/stock.js';

const alive = (rows) => rows.filter((r) => !r.deleted);
const byName = (a, b) => a.name.localeCompare(b.name, 'es');

export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}

export function useDevice() {
  return useLiveQuery(() => getDevice(), []);
}

export function useCategories() {
  return useLiveQuery(async () => alive(await db.categories.toArray()).sort(byName), []);
}

export function useSuppliers() {
  return useLiveQuery(async () => alive(await db.suppliers.toArray()).sort(byName), []);
}

export function useProducts() {
  return useLiveQuery(async () => alive(await db.products.toArray()).sort(byName), []);
}

/** Map productId -> stock actual (movimientos menos ventas). */
export function useStockMap() {
  return useLiveQuery(async () => computeStockMap(await db.stockMoves.toArray(), await db.sales.toArray()), []);
}

/** Ventas no borradas (incluye anuladas), de la más nueva a la más vieja. */
export function useSales() {
  return useLiveQuery(async () => alive(await db.sales.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
}

/** Compras no borradas, de la más nueva a la más vieja. */
export function usePurchases() {
  return useLiveQuery(async () => alive(await db.purchases.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), []);
}

/** Map id -> registro, para buscar rápido nombres de categoría o proveedor. */
export function indexById(rows) {
  return new Map((rows || []).map((r) => [r.id, r]));
}

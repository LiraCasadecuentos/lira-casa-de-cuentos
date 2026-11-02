// Operaciones sobre la base de datos. Todas las pantallas guardan a través de
// estas funciones, así cada registro siempre queda con sus fechas e id.

import { db } from './db.js';
import { newId, nameId, nowIso, todayIso } from './ids.js';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from './defaults.js';
import { MOVE_TYPES } from '../logic/stock.js';
import { computePricing } from '../logic/pricing.js';
import { cents } from '../logic/money.js';

// ---------- Dispositivo (datos locales que no viajan en respaldos) ----------

export async function getDevice() {
  let device = await db.device.get('this');
  if (!device) {
    device = { key: 'this', deviceId: newId(), deviceName: '', lastBackupAt: null, lastImportAt: null, createdAt: nowIso() };
    await db.device.put(device);
  }
  return device;
}

export async function updateDevice(changes) {
  const device = await getDevice();
  await db.device.put({ ...device, ...changes });
}

// ---------- Guardado genérico ----------

/** Completa id, fechas y dispositivo, y guarda. Devuelve el registro guardado. */
export async function saveRecord(table, record) {
  const { deviceId } = await getDevice();
  const now = nowIso();
  const full = {
    ...record,
    id: record.id || newId(),
    createdAt: record.createdAt || now,
    updatedAt: now,
    deviceId,
    deleted: record.deleted ?? false,
  };
  await db[table].put(full);
  return full;
}

/** "Borra" un registro: lo marca como borrado para que el borrado viaje en los respaldos. */
export async function softDelete(table, id) {
  const record = await db[table].get(id);
  if (!record) return;
  await saveRecord(table, { ...record, deleted: true });
}

/** Todos los registros no borrados de una tabla. */
export async function listActive(table) {
  return (await db[table].toArray()).filter((r) => !r.deleted);
}

// ---------- Configuración ----------

/** Crea la configuración y las categorías de base la primera vez que se abre la app. */
export async function ensureDefaults() {
  await getDevice();
  const settings = await db.settings.get('general');
  if (!settings) await saveRecord('settings', { ...DEFAULT_SETTINGS });
  for (const cat of DEFAULT_CATEGORIES) {
    if (!(await db.categories.get(cat.id))) await saveRecord('categories', { ...cat });
  }
  // Pedimos al navegador que no borre los datos solo (importante en iPhone/iPad).
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Si el navegador no lo permite, seguimos igual.
  }
}

export async function getSettings() {
  const s = await db.settings.get('general');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function updateSettings(changes) {
  const current = await getSettings();
  return saveRecord('settings', { ...current, ...changes });
}

// ---------- Categorías ----------

export async function saveCategory(category) {
  const name = category.name.trim();
  if (!name) throw new Error('La categoría necesita un nombre.');
  const all = await listActive('categories');
  const repeated = all.find((c) => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase());
  if (repeated) throw new Error(`Ya hay una categoría llamada "${repeated.name}".`);
  if (category.id) return saveRecord('categories', { ...category, name });
  return saveRecord('categories', { ...category, id: await freeNameId('categories', 'cat', name), name, active: true, fields: category.fields || [] });
}

// ---------- Proveedores ----------

export async function saveSupplier(supplier) {
  const name = supplier.name.trim();
  if (!name) throw new Error('El proveedor necesita un nombre.');
  const all = await listActive('suppliers');
  const repeated = all.find((s) => s.id !== supplier.id && s.name.trim().toLowerCase() === name.toLowerCase());
  if (repeated) throw new Error(`Ya hay un proveedor llamado "${repeated.name}".`);
  if (supplier.id) return saveRecord('suppliers', { ...supplier, name });
  return saveRecord('suppliers', { ...supplier, id: await freeNameId('suppliers', 'prov', name), name });
}

/** Id armado con el nombre. Si ese id estaba usado por algo borrado, se reutiliza (queda "revivido"). */
async function freeNameId(table, prefix, name) {
  const base = nameId(prefix, name);
  const existing = await db[table].get(base);
  if (!existing || existing.deleted) return base;
  return `${base}-${newId().slice(0, 8)}`;
}

/** Busca una categoría o proveedor por nombre (sin importar mayúsculas) y si no existe lo crea. */
export async function findOrCreateByName(table, name, extra = {}) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const all = await listActive(table);
  const found = all.find((r) => r.name.trim().toLowerCase() === clean.toLowerCase());
  if (found) return found;
  if (table === 'categories') return saveCategory({ name: clean, fields: [], defaultMarkup: null, ...extra });
  return saveSupplier({ name: clean, ...extra });
}

// ---------- Productos ----------

/** Valores por defecto de un producto nuevo. trackStock = false servirá para productos de bar sin stock. */
export function emptyProduct() {
  return {
    name: '',
    categoryId: '',
    supplierId: '',
    code: '',
    pricingMode: 'recargo',
    baseCost: null,
    listPrice: null,
    supplierDiscount: null,
    markupPct: null,
    cost: 0,
    salePrice: 0,
    priceIsManual: false,
    stockMin: 1,
    trackStock: true,
    ownership: 'propio',
    consignmentType: 'porcentaje',
    consignmentValue: null,
    extras: {},
    notes: '',
    active: true,
  };
}

/**
 * Guarda un producto. Recalcula el costo desde los datos de precio, y si
 * cambió el costo o el precio deja registro en el historial de precios.
 * options.initialStock: stock inicial (solo productos nuevos).
 * options.reason: motivo del cambio de precio.
 */
export async function saveProduct(product, options = {}) {
  if (!product.name?.trim()) throw new Error('El producto necesita un nombre.');
  const [settings, supplier, category] = await Promise.all([
    getSettings(),
    product.supplierId ? db.suppliers.get(product.supplierId) : null,
    product.categoryId ? db.categories.get(product.categoryId) : null,
  ]);
  const pricing = computePricing({ product, supplier, category, settings });
  const salePrice = product.priceIsManual || product.salePrice ? cents(product.salePrice) : pricing.suggested;
  const previous = product.id ? await db.products.get(product.id) : null;

  const saved = await saveRecord('products', {
    ...product,
    name: product.name.trim(),
    code: String(product.code || '').trim(),
    cost: pricing.cost,
    salePrice,
  });

  if (!previous || previous.cost !== saved.cost || previous.salePrice !== saved.salePrice) {
    await saveRecord('priceHistory', {
      productId: saved.id,
      date: nowIso(),
      oldCost: previous?.cost ?? null,
      newCost: saved.cost,
      oldPrice: previous?.salePrice ?? null,
      newPrice: saved.salePrice,
      reason: options.reason || (previous ? 'Edición del producto' : 'Alta del producto'),
    });
  }

  const initial = Number(options.initialStock) || 0;
  if (!previous && initial !== 0) {
    await addStockMove({ productId: saved.id, qty: initial, type: MOVE_TYPES.INITIAL, note: 'Stock inicial' });
  }
  return saved;
}

// ---------- Stock ----------

export async function addStockMove({ productId, qty, type, refId = null, note = '', date = todayIso() }) {
  return saveRecord('stockMoves', { productId, qty: Number(qty), type, refId, note, date });
}

/** Lleva el stock a lo contado a mano, dejando un movimiento de ajuste. */
export async function adjustStock(productId, currentStock, countedStock, note = 'Ajuste manual') {
  const diff = Number(countedStock) - Number(currentStock);
  if (!diff) return null;
  return addStockMove({ productId, qty: diff, type: MOVE_TYPES.ADJUST, note });
}

// ---------- Compras ----------

/**
 * Registra una compra y suma al stock.
 * items: [{ productId, qty, unitCost }]
 */
export async function savePurchase({ date, supplierId, items, paid = true, dueDate = null, invoiceNumber = '', notes = '', source = 'manual' }) {
  const total = cents(items.reduce((s, i) => s + Number(i.qty) * Number(i.unitCost || 0), 0));
  const purchase = await saveRecord('purchases', { date, supplierId, items, total, paid, dueDate, invoiceNumber, notes, source });
  for (const item of items) {
    await addStockMove({ productId: item.productId, qty: item.qty, type: MOVE_TYPES.PURCHASE, refId: purchase.id, date, note: 'Compra' });
  }
  return purchase;
}

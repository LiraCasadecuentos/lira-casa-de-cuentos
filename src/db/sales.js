// Guardar, editar y anular ventas.
//
// Forma de una venta:
//   date            "2026-11-02T15:30" (hora local, editable para cargar ventas de días anteriores)
//   items           [{ productId, name, qty, unitPrice, unitCost, trackStock, ownership, consignmentType, consignmentValue, supplierId }]
//                   precio y costo quedan "congelados" al momento de la venta
//   discount        { type: 'monto' | 'porcentaje', value } o null
//   shipping        { mode: '' | 'retiro' | 'envio', amount }
//   paymentMethod, channel, customer, note
//   status          'confirmada' | 'anulada'
//   totals          resultado de computeSaleTotals (se guarda para los informes)
//   history         registro de cambios: [{ at, action, detail }]
//   mode            'normal' | 'feria'
// Preparado para el futuro (todavía sin uso):
//   orderId         seña / encargo asociado
//   invoice         comprobante o factura electrónica
//   table           mesa (si se suma el bar)

import { db } from './db.js';
import { saveRecord, updateDevice } from './repo.js';
import { nowIso } from './ids.js';
import { computeSaleTotals, SALE_STATUS } from '../logic/sales.js';
import { formatMoney } from '../logic/money.js';

/** Línea de venta a partir de un producto, con su precio y costo de hoy. */
export function saleItemFromProduct(product, qty = 1) {
  return {
    productId: product.id,
    name: product.name,
    qty,
    unitPrice: product.salePrice || 0,
    unitCost: product.cost || 0,
    trackStock: product.trackStock !== false,
    ownership: product.ownership || 'propio',
    consignmentType: product.consignmentType || null,
    consignmentValue: product.consignmentValue ?? null,
    supplierId: product.supplierId || '',
  };
}

/** Guarda una venta nueva o los cambios de una existente (dejando registro). */
export async function saveSale(sale) {
  if (!sale.items?.length) throw new Error('La venta no tiene productos.');
  if (sale.items.some((i) => !(Number(i.qty) > 0))) throw new Error('Hay un producto con cantidad 0. Sacalo o poné una cantidad.');
  if (!sale.paymentMethod) throw new Error('Elegí la forma de pago.');

  const totals = computeSaleTotals(sale);
  const previous = sale.id ? await db.sales.get(sale.id) : null;
  const history = [...(previous?.history || [])];
  if (previous) {
    history.push({ at: nowIso(), action: 'editada', detail: describeChanges(previous, { ...sale, totals }) });
  } else {
    history.push({ at: nowIso(), action: 'creada', detail: `Total ${formatMoney(totals.total)}` });
  }

  const saved = await saveRecord('sales', {
    orderId: null,
    invoice: null,
    table: null,
    mode: 'normal',
    ...sale,
    status: sale.status || SALE_STATUS.OK,
    totals,
    history,
  });
  // Recordamos la última forma de pago y canal en este dispositivo (el modo feria guarda su propia forma de pago).
  if (saved.mode === 'feria') await updateDevice({ lastFeriaPaymentMethod: sale.paymentMethod });
  else await updateDevice({ lastPaymentMethod: sale.paymentMethod, lastChannel: sale.channel || '' });
  return saved;
}

/** Anula una venta: deja de contar y el stock vuelve. La venta queda guardada como "anulada". */
export async function voidSale(id, reason = '') {
  const sale = await db.sales.get(id);
  if (!sale || sale.status === SALE_STATUS.VOID) return;
  await saveRecord('sales', {
    ...sale,
    status: SALE_STATUS.VOID,
    history: [...(sale.history || []), { at: nowIso(), action: 'anulada', detail: reason || 'Sin motivo' }],
  });
}

/** Texto corto con lo que cambió entre dos versiones de una venta. */
function describeChanges(before, after) {
  const parts = [];
  if (before.totals?.total !== after.totals.total) parts.push(`total ${formatMoney(before.totals?.total)} → ${formatMoney(after.totals.total)}`);
  const qty = (s) => s.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
  if (qty(before) !== qty(after)) parts.push(`productos: ${qty(after)}`);
  if (before.paymentMethod !== after.paymentMethod) parts.push(`pago: ${after.paymentMethod}`);
  if (before.channel !== after.channel) parts.push(`canal: ${after.channel}`);
  if (before.date !== after.date) parts.push(`fecha: ${after.date.replace('T', ' ')}`);
  return parts.join(' · ') || 'Cambios menores';
}

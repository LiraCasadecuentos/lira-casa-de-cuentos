// Consignaciones: cuánto se vendió de cada proveedor que deja productos en consignación
// y cuánto se le debe.
//
// Por cada unidad vendida al proveedor le corresponde:
//   'porcentaje'  un % de lo que se cobró (con el descuento de la venta ya aplicado)
//   'monto'       un monto fijo por unidad
// Se usa lo que quedó guardado en la venta. Si en ese momento no estaba definido,
// se usa lo que tenga hoy el producto. Si tampoco, queda marcado como "sin definir".

import { cents } from './money.js';
import { salesInRange } from './reports.js';

export function consignmentReport(sales, from, to, productsById = new Map(), suppliersById = new Map()) {
  const groups = new Map();
  for (const s of salesInRange(sales, from, to)) {
    const factor = s.totals.subtotal ? s.totals.productsTotal / s.totals.subtotal : 1;
    for (const i of s.items) {
      const product = productsById.get(i.productId);
      const isConsignment = i.ownership === 'consignacion' || (!i.ownership && product?.ownership === 'consignacion');
      if (!isConsignment) continue;
      const supplierId = i.supplierId || product?.supplierId || '';
      const type = i.consignmentValue != null ? i.consignmentType : product?.consignmentType;
      const value = i.consignmentValue ?? product?.consignmentValue ?? null;
      const charged = i.qty * i.unitPrice * factor;
      const owed = value == null ? null : type === 'monto' ? i.qty * Number(value) : (charged * Number(value)) / 100;

      const g = groups.get(supplierId) || { supplierId, supplier: suppliersById.get(supplierId)?.name || 'Sin proveedor', rows: new Map(), units: 0, charged: 0, owed: 0, undefinedUnits: 0 };
      const row = g.rows.get(i.productId) || { productId: i.productId, name: i.name, qty: 0, charged: 0, owed: 0, rule: value == null ? 'Sin definir' : type === 'monto' ? `${value} por unidad` : `${value} %`, missing: false };
      row.qty += i.qty;
      row.charged = cents(row.charged + charged);
      if (owed == null) row.missing = true;
      else row.owed = cents(row.owed + owed);
      g.rows.set(i.productId, row);
      g.units += i.qty;
      g.charged = cents(g.charged + charged);
      if (owed == null) g.undefinedUnits += i.qty;
      else g.owed = cents(g.owed + owed);
      groups.set(supplierId, g);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, rows: [...g.rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier, 'es'));
}

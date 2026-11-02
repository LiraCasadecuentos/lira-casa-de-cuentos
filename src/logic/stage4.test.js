import { describe, it, expect } from 'vitest';
import { previewMassUpdate, roundForChange } from './massPrices.js';
import { consignmentReport } from './consignment.js';
import { findDuplicateProducts } from './merge.js';
import { computeSaleTotals } from './sales.js';
import { normalize } from './text.js';

const settings = { roundingStep: 100, vatPct: 21, defaultMarkup: 100 };
const mapa = { id: 'mapa', name: 'Mapa', pricingMode: 'recargo', baseCost: 7294, cost: 7294, salePrice: 16800, supplierId: 'atl' };
const libro = { id: 'libro', name: 'Libro', pricingMode: 'lista', listPrice: 15000, supplierDiscount: 35, cost: 9750, salePrice: 15000, supplierId: 'cal' };
const libroManual = { ...libro, id: 'libro2', salePrice: 16000 };

describe('actualización masiva de precios', () => {
  it('solo precio: sube el % y redondea hacia arriba', () => {
    const [r] = previewMassUpdate([mapa], { pct: 10, mode: 'precio', round: true, settings });
    expect(r.newPrice).toBe(18500); // 16.800 × 1,1 = 18.480 → 18.500
    expect(r.newCost).toBe(7294);
  });

  it('al bajar redondea al más cercano', () => {
    expect(roundForChange(15120, 100, false)).toBe(15100);
    const [r] = previewMassUpdate([mapa], { pct: -10, mode: 'precio', round: true, settings });
    expect(r.newPrice).toBe(15100);
  });

  it('sin redondeo deja el número exacto', () => {
    const [r] = previewMassUpdate([mapa], { pct: 10, mode: 'precio', round: false, settings });
    expect(r.newPrice).toBe(18480);
  });

  it('aumento del proveedor: sube costo y precio; el libro al PVP sigue al PVP', () => {
    const rows = previewMassUpdate([mapa, libro, libroManual], { pct: 20, mode: 'proveedor', round: true, settings });
    const m = rows.find((r) => r.product.id === 'mapa');
    expect(m.newCost).toBe(8752.8);
    expect(m.newPrice).toBe(20200); // 16.800 × 1,2 = 20.160 → 20.200
    const l = rows.find((r) => r.product.id === 'libro');
    expect(l.changes.listPrice).toBe(18000);
    expect(l.newCost).toBe(11700);
    expect(l.newPrice).toBe(18000);
    const lm = rows.find((r) => r.product.id === 'libro2');
    expect(lm.newPrice).toBe(19200); // no estaba al PVP: sube el % y redondea
  });

  it('respeta el IVA del proveedor al recalcular el costo', () => {
    const [r] = previewMassUpdate([mapa], { pct: 10, mode: 'proveedor', round: true, settings, suppliersById: new Map([['atl', { addVat: true }]]) });
    expect(r.newCost).toBe(9708.31); // 7294 × 1,1 = 8023,40; × 1,21 = 9708,314
  });
});

describe('consignaciones', () => {
  const sale = (items, extra = {}) => {
    const s = { date: '2026-11-10T10:00', status: 'confirmada', items, ...extra };
    return { ...s, totals: computeSaleTotals(s) };
  };
  const item = (productId, qty, unitPrice, extra) => ({ productId, name: productId, qty, unitPrice, unitCost: 0, ...extra });

  it('calcula lo que se le debe a cada proveedor', () => {
    const sales = [
      sale([item('taza', 2, 10000, { ownership: 'consignacion', consignmentType: 'porcentaje', consignmentValue: 60, supplierId: 'p1' }), item('mapa', 1, 16800, { ownership: 'propio' })]),
      sale([item('vela', 3, 5000, { ownership: 'consignacion', consignmentType: 'monto', consignmentValue: 2000, supplierId: 'p1' })]),
      sale([item('taza', 5, 10000, { ownership: 'consignacion', consignmentType: 'porcentaje', consignmentValue: 60, supplierId: 'p1' })], { status: 'anulada' }),
    ];
    const [g] = consignmentReport(sales, '2026-11-01', '2026-11-30', new Map(), new Map([['p1', { name: 'Artesana' }]]));
    expect(g.supplier).toBe('Artesana');
    expect(g.units).toBe(5);
    expect(g.owed).toBe(12000 + 6000);
  });

  it('el porcentaje se calcula sobre lo cobrado (con descuento)', () => {
    const sales = [sale([item('taza', 1, 10000, { ownership: 'consignacion', consignmentType: 'porcentaje', consignmentValue: 50, supplierId: 'p1' })], { discount: { type: 'porcentaje', value: 10 } })];
    expect(consignmentReport(sales, '2026-11-01', '2026-11-30')[0].owed).toBe(4500);
  });

  it('si no estaba definido usa el valor actual del producto, y si no hay, avisa', () => {
    const sales = [sale([item('taza', 2, 10000, { ownership: 'consignacion', supplierId: 'p1' }), item('vela', 1, 5000, { ownership: 'consignacion', supplierId: 'p1' })])];
    const products = new Map([['taza', { consignmentType: 'monto', consignmentValue: 3000 }]]);
    const [g] = consignmentReport(sales, '2026-11-01', '2026-11-30', products);
    expect(g.owed).toBe(6000);
    expect(g.undefinedUnits).toBe(1);
    expect(g.rows.find((r) => r.productId === 'vela').missing).toBe(true);
  });
});

describe('productos repetidos', () => {
  it('encuentra mismo código o mismo nombre (sin tildes ni mayúsculas)', () => {
    const groups = findDuplicateProducts([
      { id: '1', name: 'Mapa Argentina', code: '200012' },
      { id: '2', name: 'MAPA ARGENTINA (copia)', code: '200012' },
      { id: '3', name: 'Poesía a la carta' },
      { id: '4', name: 'poesia a la carta' },
      { id: '5', name: 'Único' },
      { id: '6', name: 'Borrado', code: '200012', deleted: true },
    ], normalize);
    expect(groups.map((g) => g.map((p) => p.id))).toEqual([['1', '2'], ['3', '4']]);
  });
});

import { describe, it, expect } from 'vitest';
import { computeSaleTotals, discountAmount, stockShortages, summarizeSales, weekStart, isActiveSale, soldUnitsMap } from './sales.js';
import { computeStockMap } from './stock.js';
import { mergeRecords } from './merge.js';

const mapa = { qty: 2, unitPrice: 16800, unitCost: 7294 };
const libro = { qty: 1, unitPrice: 15000, unitCost: 9750 };

describe('totales de una venta', () => {
  it('suma productos y calcula la ganancia bruta con el costo guardado', () => {
    const t = computeSaleTotals({ items: [mapa, libro] });
    expect(t.subtotal).toBe(48600);
    expect(t.costTotal).toBe(24338);
    expect(t.profit).toBe(24262);
    expect(t.total).toBe(48600);
    expect(t.units).toBe(3);
  });

  it('el envío se cobra aparte y no suma a la ganancia', () => {
    const t = computeSaleTotals({ items: [libro], shipping: { mode: 'envio', amount: 3500 } });
    expect(t.total).toBe(18500);
    expect(t.shipping).toBe(3500);
    expect(t.profit).toBe(5250);
  });

  it('si es retiro, el monto de envío no cuenta', () => {
    expect(computeSaleTotals({ items: [libro], shipping: { mode: 'retiro', amount: 3500 } }).total).toBe(15000);
  });

  it('el descuento baja el total y la ganancia', () => {
    const t = computeSaleTotals({ items: [libro], discount: { type: 'porcentaje', value: 10 } });
    expect(t.discount).toBe(1500);
    expect(t.total).toBe(13500);
    expect(t.profit).toBe(3750);
  });
});

describe('descuento', () => {
  it('en pesos o en porcentaje', () => {
    expect(discountAmount(10000, { type: 'monto', value: 500 })).toBe(500);
    expect(discountAmount(10000, { type: 'porcentaje', value: 15 })).toBe(1500);
  });
  it('nunca más que el subtotal ni negativo', () => {
    expect(discountAmount(10000, { type: 'monto', value: 50000 })).toBe(10000);
    expect(discountAmount(10000, { type: 'porcentaje', value: 150 })).toBe(10000);
    expect(discountAmount(10000, { type: 'monto', value: -5 })).toBe(0);
    expect(discountAmount(10000, null)).toBe(0);
  });
});

describe('stock con ventas', () => {
  const moves = [{ id: 'm1', productId: 'mapa', qty: 6 }];
  const venta = (id, qty, extra = {}) => ({ id, status: 'confirmada', items: [{ productId: 'mapa', qty }], createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', ...extra });

  it('las ventas restan del stock', () => {
    expect(computeStockMap(moves, [venta('v1', 2), venta('v2', 1)]).get('mapa')).toBe(3);
  });

  it('una venta anulada devuelve el stock', () => {
    expect(computeStockMap(moves, [venta('v1', 2, { status: 'anulada' })]).get('mapa')).toBe(6);
  });

  it('editar una venta corrige el stock', () => {
    expect(computeStockMap(moves, [venta('v1', 4)]).get('mapa')).toBe(2);
  });

  it('si se anula en otro dispositivo, al unir respaldos el stock vuelve', () => {
    const local = [venta('v1', 2)];
    const otro = [venta('v1', 2, { status: 'anulada', updatedAt: '2026-11-02T10:00:00Z' })];
    const merged = mergeRecords(local, otro);
    const sales = local.map((s) => merged.records.find((r) => r.id === s.id) || s);
    expect(computeStockMap(moves, sales).get('mapa')).toBe(6);
  });

  it('avisa si no alcanza el stock (sin bloquear)', () => {
    const stockMap = new Map([['mapa', 1]]);
    expect(stockShortages([{ productId: 'mapa', qty: 3 }], stockMap)).toEqual([{ productId: 'mapa', wanted: 3, available: 1 }]);
    expect(stockShortages([{ productId: 'mapa', qty: 1 }], stockMap)).toEqual([]);
  });

  it('al editar una venta no cuenta dos veces sus propias unidades', () => {
    const stockMap = new Map([['mapa', 0]]); // ya descontadas las 2 de esta venta
    expect(stockShortages([{ productId: 'mapa', qty: 2 }], stockMap, [{ productId: 'mapa', qty: 2 }])).toEqual([]);
  });

  it('cuenta unidades vendidas sin las anuladas', () => {
    expect(soldUnitsMap([venta('v1', 2), venta('v2', 5, { status: 'anulada' })]).get('mapa')).toBe(2);
  });
});

describe('resúmenes por período', () => {
  const s = (date, total, extra = {}) => ({ date, status: 'confirmada', totals: { total, productsTotal: total, shipping: 0, profit: total / 2 }, ...extra });
  const sales = [s('2026-11-02T10:00', 1000), s('2026-11-02T18:00', 500), s('2026-11-01T12:00', 300), s('2026-11-02T11:00', 9999, { status: 'anulada' }), s('2026-11-02T11:00', 7777, { deleted: true })];

  it('suma solo las ventas que cuentan en el rango', () => {
    expect(summarizeSales(sales, '2026-11-02', '2026-11-02')).toMatchObject({ count: 2, total: 1500, profit: 750 });
    expect(summarizeSales(sales, '2026-11-01', '2026-11-02')).toMatchObject({ count: 3, total: 1800 });
  });

  it('la semana empieza el lunes', () => {
    expect(weekStart('2026-11-02')).toBe('2026-11-02'); // lunes
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // domingo
    expect(weekStart('2026-11-04')).toBe('2026-11-02');
  });

  it('anuladas y borradas no cuentan', () => {
    expect(isActiveSale({ status: 'anulada' })).toBe(false);
    expect(isActiveSale({ status: 'confirmada', deleted: true })).toBe(false);
    expect(isActiveSale({ status: 'confirmada' })).toBe(true);
  });
});

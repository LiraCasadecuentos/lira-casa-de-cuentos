import { describe, it, expect } from 'vitest';
import { periodRange, shiftPeriod, salesOverTime, salesGroupedBy, productRanking, unsoldProducts, profitReport, stockReport, restockList } from './reports.js';
import { cashSummary } from './cash.js';
import { computeSaleTotals } from './sales.js';

const sale = (id, date, items, extra = {}) => {
  const s = { id, date, items, status: 'confirmada', paymentMethod: 'Efectivo', channel: 'Feria', ...extra };
  return { ...s, totals: computeSaleTotals(s) };
};
const mapa = (qty) => ({ productId: 'mapa', name: 'Mapa', qty, unitPrice: 16800, unitCost: 7294 });
const libro = (qty) => ({ productId: 'libro', name: 'Libro', qty, unitPrice: 15000, unitCost: 9750 });

const sales = [
  sale('a', '2026-11-02T10:00', [mapa(2)]),
  sale('b', '2026-11-02T12:00', [libro(1)], { paymentMethod: 'Transferencia', channel: 'Instagram', shipping: { mode: 'envio', amount: 3000 } }),
  sale('c', '2026-11-03T12:00', [mapa(1), libro(1)], { discount: { type: 'monto', value: 3180 } }),
  sale('d', '2026-11-03T13:00', [mapa(5)], { status: 'anulada' }),
  sale('e', '2026-10-15T13:00', [libro(1)], { channel: 'WhatsApp' }),
];

describe('períodos', () => {
  it('día, semana (lunes a domingo) y mes', () => {
    expect(periodRange('dia', '2026-11-04')).toMatchObject({ from: '2026-11-04', to: '2026-11-04' });
    expect(periodRange('semana', '2026-11-04')).toMatchObject({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodRange('mes', '2026-02-10')).toMatchObject({ from: '2026-02-01', to: '2026-02-28', label: 'Febrero 2026' });
    expect(periodRange('rango', '2026-11-01', '2026-10-01', '2026-10-31')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
  });
  it('anterior y siguiente', () => {
    expect(shiftPeriod('mes', '2026-01-31', -1)).toBe('2025-12-01');
    expect(shiftPeriod('semana', '2026-11-04', 1)).toBe('2026-11-11');
    expect(shiftPeriod('dia', '2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('ventas por período', () => {
  it('incluye días sin ventas y no cuenta anuladas', () => {
    const { rows, byMonth } = salesOverTime(sales, '2026-11-01', '2026-11-03');
    expect(byMonth).toBe(false);
    expect(rows.map((r) => r.count)).toEqual([0, 2, 1]);
    expect(rows[1].total).toBe(33600 + 18000);
  });
  it('con rangos largos agrupa por mes', () => {
    const { rows, byMonth } = salesOverTime(sales, '2026-08-01', '2026-11-30');
    expect(byMonth).toBe(true);
    expect(rows.map((r) => r.key)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(rows[2].count).toBe(1);
  });
});

describe('por canal y forma de pago', () => {
  it('agrupa y ordena por total', () => {
    const rows = salesGroupedBy(sales, '2026-11-01', '2026-11-30', 'channel');
    expect(rows.map((r) => r.key)).toEqual(['Feria', 'Instagram']);
    expect(rows[0].count).toBe(2);
    expect(Math.round(rows.reduce((s, r) => s + r.share, 0))).toBe(100);
  });
});

describe('lo más vendido', () => {
  it('reparte el descuento entre los productos de la venta', () => {
    const rows = productRanking(sales, '2026-11-01', '2026-11-30');
    const m = rows.find((r) => r.productId === 'mapa');
    const l = rows.find((r) => r.productId === 'libro');
    expect(m.qty).toBe(3);
    // venta c: subtotal 31.800, descuento 3.180 (10 %) → mapa 15.120 y libro 13.500
    expect(m.revenue).toBe(33600 + 15120);
    expect(l.revenue).toBe(15000 + 13500);
    expect(m.profit).toBe(m.revenue - 3 * 7294);
  });
});

describe('lo que no se vende', () => {
  const products = [
    { id: 'mapa', name: 'Mapa', cost: 7294, salePrice: 16800 },
    { id: 'libro', name: 'Libro', cost: 9750, salePrice: 15000 },
    { id: 'globo', name: 'Globo', cost: 9290, salePrice: 18800 },
    { id: 'agotado', name: 'Agotado', cost: 100, salePrice: 200 },
  ];
  const stock = new Map([['mapa', 3], ['libro', 2], ['globo', 1], ['agotado', 0]]);
  it('muestra productos con stock y sin ventas en el período', () => {
    const rows = unsoldProducts(products, sales, stock, 30, '2026-11-30');
    expect(rows.map((r) => r.product.id)).toEqual(['globo']);
    const rows10 = unsoldProducts(products, sales, stock, 10, '2026-11-30');
    // Primero lo que tiene más plata parada a costo: mapa 3 × 7.294, libro 2 × 9.750, globo 1 × 9.290.
    expect(rows10.map((r) => r.product.id)).toEqual(['mapa', 'libro', 'globo']);
    expect(rows10[0].lastSale).toBe('2026-11-03');
  });
});

describe('ganancias', () => {
  it('bruta = ventas − costo; neta = bruta − gastos; el envío queda aparte', () => {
    const expenses = [
      { date: '2026-11-02', amount: 2000, category: 'Packaging' },
      { date: '2026-11-20', amount: 1000, category: 'Comisiones de cobro' },
      { date: '2026-10-02', amount: 99999, category: 'Otros' },
      { date: '2026-11-05', amount: 5000, category: 'Otros', deleted: true },
    ];
    const r = profitReport(sales, expenses, '2026-11-01', '2026-11-30');
    expect(r.sold).toBe(33600 + 15000 + 28620);
    expect(r.cost).toBe(2 * 7294 + 9750 + 7294 + 9750);
    expect(r.gross).toBe(r.sold - r.cost);
    expect(r.expenses).toBe(3000);
    expect(r.net).toBe(r.gross - 3000);
    expect(r.shipping).toBe(3000);
  });
});

describe('stock', () => {
  const products = [
    { id: 'a', name: 'A', cost: 100, salePrice: 250, stockMin: 2, supplierId: 's1' },
    { id: 'b', name: 'B', cost: 50, salePrice: 100, stockMin: 1, supplierId: 's2' },
    { id: 'c', name: 'C', cost: 10, salePrice: 20, stockMin: 0 },
  ];
  const stock = new Map([['a', 1], ['b', 5], ['c', -1]]);
  it('valor del inventario a costo y a precio de venta (sin contar negativos)', () => {
    const r = stockReport(products, stock);
    expect(r.units).toBe(6);
    expect(r.costValue).toBe(100 + 250);
    expect(r.saleValue).toBe(250 + 500);
  });
  it('lista para reponer agrupada por proveedor', () => {
    const groups = restockList(products, stock, new Map([['s1', { name: 'Atlantis' }]]));
    expect(groups.map((g) => g.supplier)).toEqual(['Atlantis', 'Sin proveedor']);
    expect(groups[0].rows[0]).toMatchObject({ stock: 1, min: 2, suggested: 3 });
  });
});

describe('caja diaria', () => {
  it('efectivo esperado y diferencia', () => {
    const r = cashSummary({
      day: '2026-11-02',
      sales,
      cashMoves: [
        { date: '2026-11-02', type: 'entrada', amount: 1000 },
        { date: '2026-11-02', type: 'salida', amount: 2500 },
        { date: '2026-11-01', type: 'salida', amount: 9999 },
      ],
      expenses: [{ date: '2026-11-02', amount: 700, fromCash: true }, { date: '2026-11-02', amount: 5000, fromCash: false }],
      session: { openingAmount: 10000, countedAmount: 41000 },
      paymentMethods: ['Efectivo', 'Transferencia', 'Mercado Pago'],
    });
    expect(r.cashSales).toBe(33600);
    expect(r.byMethod.find((m) => m.method === 'Transferencia').total).toBe(18000);
    expect(r.byMethod.find((m) => m.method === 'Mercado Pago').total).toBe(0);
    expect(r.expected).toBe(10000 + 33600 + 1000 - 2500 - 700);
    expect(r.difference).toBe(41000 - 41400);
  });
  it('sin cierre no hay diferencia', () => {
    const r = cashSummary({ day: '2026-11-02', sales: [], cashMoves: [], expenses: [], session: null });
    expect(r.expected).toBe(0);
    expect(r.difference).toBeNull();
  });
});

// Caja diaria.
//
// Efectivo esperado al cerrar =
//     monto inicial
//   + ventas del día cobradas en efectivo (incluye el envío si se cobró en efectivo)
//   + entradas manuales
//   − salidas manuales
//   − gastos del día pagados con plata de la caja
// La diferencia es lo contado menos lo esperado (positivo = sobra, negativo = falta).

import { cents } from './money.js';
import { isActiveSale, dayOf } from './sales.js';

export const CASH_METHOD = 'Efectivo';

/** Id fijo de la caja de un día: así, si se abre en dos dispositivos, al unir queda una sola. */
export function cashSessionId(day) {
  return `caja-${day}`;
}

export function cashSummary({ day, sales, cashMoves, expenses, session, paymentMethods = [] }) {
  const daySales = sales.filter((s) => isActiveSale(s) && dayOf(s.date) === day);

  const byMethod = new Map(paymentMethods.map((m) => [m, { method: m, count: 0, total: 0 }]));
  for (const s of daySales) {
    const key = s.paymentMethod || 'Sin dato';
    const row = byMethod.get(key) || { method: key, count: 0, total: 0 };
    row.count++;
    row.total = cents(row.total + s.totals.total);
    byMethod.set(key, row);
  }

  const moves = cashMoves.filter((m) => !m.deleted && m.date === day);
  const inflow = cents(moves.filter((m) => m.type === 'entrada').reduce((s, m) => s + Number(m.amount), 0));
  const outflow = cents(moves.filter((m) => m.type === 'salida').reduce((s, m) => s + Number(m.amount), 0));
  const cashExpenses = cents(expenses.filter((e) => !e.deleted && e.date === day && e.fromCash).reduce((s, e) => s + Number(e.amount), 0));
  const cashSales = byMethod.get(CASH_METHOD)?.total || 0;
  const opening = cents(Number(session?.openingAmount) || 0);
  const expected = cents(opening + cashSales + inflow - outflow - cashExpenses);
  const counted = session?.countedAmount;
  const hasCount = counted !== null && counted !== undefined && counted !== '';

  return {
    salesCount: daySales.length,
    salesTotal: cents(daySales.reduce((s, x) => s + x.totals.total, 0)),
    byMethod: [...byMethod.values()],
    moves,
    opening,
    cashSales,
    inflow,
    outflow,
    cashExpenses,
    expected,
    counted: hasCount ? cents(counted) : null,
    difference: hasCount ? cents(Number(counted) - expected) : null,
  };
}

// Caja diaria y gastos.
//
// cashSessions: una por día (id "caja-2026-11-02")
//   { date, openingAmount, countedAmount, closedAt, notes }
// cashMoves: entradas y salidas manuales de efectivo
//   { date, type: 'entrada' | 'salida', amount, description }
// expenses: gastos del negocio
//   { date, description, amount, category, fromCash }  fromCash = se pagó con plata de la caja

import { db } from './db.js';
import { saveRecord, softDelete } from './repo.js';
import { nowIso } from './ids.js';
import { cashSessionId } from '../logic/cash.js';
import { cents } from '../logic/money.js';

export async function getCashSession(day) {
  const s = await db.cashSessions.get(cashSessionId(day));
  return s && !s.deleted ? s : null;
}

/** Abre la caja del día (o corrige el monto inicial). */
export async function openCash(day, openingAmount) {
  const existing = await db.cashSessions.get(cashSessionId(day));
  return saveRecord('cashSessions', { ...(existing || {}), id: cashSessionId(day), date: day, openingAmount: cents(openingAmount || 0), deleted: false });
}

/** Cierra la caja con lo contado. Se puede volver a cerrar si se contó mal. */
export async function closeCash(day, countedAmount, notes = '') {
  const existing = await db.cashSessions.get(cashSessionId(day));
  return saveRecord('cashSessions', { openingAmount: 0, ...(existing || {}), id: cashSessionId(day), date: day, countedAmount: cents(countedAmount), closedAt: nowIso(), notes, deleted: false });
}

/** Reabre una caja cerrada (borra lo contado). */
export async function reopenCash(day) {
  const existing = await db.cashSessions.get(cashSessionId(day));
  if (!existing) return;
  await saveRecord('cashSessions', { ...existing, countedAmount: null, closedAt: null });
}

export async function addCashMove({ date, type, amount, description }) {
  if (!(Number(amount) > 0)) throw new Error('Poné un monto mayor a cero.');
  if (!description?.trim()) throw new Error('Escribí una descripción corta (por ejemplo "compré bolsas").');
  return saveRecord('cashMoves', { date, type, amount: cents(amount), description: description.trim() });
}

export const deleteCashMove = (id) => softDelete('cashMoves', id);

export async function saveExpense(expense) {
  if (!(Number(expense.amount) > 0)) throw new Error('Poné un monto mayor a cero.');
  if (!expense.description?.trim()) throw new Error('Escribí qué fue el gasto.');
  if (!expense.date) throw new Error('Falta la fecha.');
  return saveRecord('expenses', { ...expense, amount: cents(expense.amount), description: expense.description.trim(), fromCash: !!expense.fromCash });
}

export const deleteExpense = (id) => softDelete('expenses', id);

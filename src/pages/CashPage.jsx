// Caja del día: ventas por forma de pago, movimientos de efectivo, apertura y cierre.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Plus, Trash2, Lock, LockOpen, Printer } from 'lucide-react';
import { db } from '../db/db.js';
import { getCashSession, openCash, closeCash, reopenCash, addCashMove, deleteCashMove } from '../db/cash.js';
import { useSales, useSettings } from '../ui/useData.js';
import { Field, TextInput, MoneyInput, ChoiceGroup, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { cashSummary } from '../logic/cash.js';
import { addDays } from '../logic/reports.js';
import { formatMoney } from '../logic/money.js';
import { todayIso, formatDate } from '../db/ids.js';
import PrintHeader from '../ui/PrintHeader.jsx';

export default function CashPage() {
  const [day, setDay] = useState(todayIso());
  const sales = useSales();
  const settings = useSettings();
  const session = useLiveQuery(() => getCashSession(day), [day]);
  const cashMoves = useLiveQuery(() => db.cashMoves.where('date').equals(day).toArray(), [day]);
  const expenses = useLiveQuery(() => db.expenses.where('date').equals(day).toArray(), [day]);
  const toast = useToast();
  const confirm = useConfirm();

  const [opening, setOpening] = useState(null);
  const [counted, setCounted] = useState(null);
  const [move, setMove] = useState({ type: 'salida', amount: null, description: '' });
  const [error, setError] = useState('');

  if (!sales || !settings || session === undefined || !cashMoves || !expenses) return null;

  const summary = cashSummary({ day, sales, cashMoves, expenses, session, paymentMethods: settings.paymentMethods });
  const isClosed = summary.counted !== null;
  const changeDay = (d) => {
    setDay(d);
    setOpening(null);
    setCounted(null);
    setError('');
  };

  async function onOpen() {
    await openCash(day, opening ?? 0);
    setOpening(null);
    toast('Caja abierta');
  }

  async function onAddMove() {
    setError('');
    try {
      await addCashMove({ date: day, ...move });
      setMove({ type: move.type, amount: null, description: '' });
      toast(move.type === 'entrada' ? 'Entrada anotada' : 'Salida anotada');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDeleteMove(m) {
    if (!(await confirm({ title: '¿Borrar este movimiento?', message: `${m.description}: ${formatMoney(m.amount)}`, confirmText: 'Borrar', danger: true }))) return;
    await deleteCashMove(m.id);
  }

  async function onClose() {
    if (counted === null) return setError('Escribí cuánto efectivo contaste.');
    setError('');
    await closeCash(day, counted);
    setCounted(null);
    toast('Caja cerrada');
  }

  const diff = summary.difference;

  return (
    <>
      <PrintHeader title="Caja del día" subtitle={formatDate(day)} />
      <div className="page-header">
        <h1>Caja del día</h1>
        <button type="button" className="btn btn-chico no-print" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /> Imprimir</button>
      </div>

      <div className="card row no-print">
        <button type="button" className="btn btn-chico" onClick={() => changeDay(addDays(day, -1))}><ChevronLeft size={20} aria-hidden="true" /> Anterior</button>
        <input type="date" value={day} onChange={(e) => changeDay(e.target.value || todayIso())} style={{ flex: '1 1 160px', width: 'auto' }} aria-label="Día de la caja" />
        <button type="button" className="btn btn-chico" onClick={() => changeDay(addDays(day, 1))}>Siguiente <ChevronRight size={20} aria-hidden="true" /></button>
        {day !== todayIso() && <button type="button" className="btn btn-chico btn-texto" onClick={() => changeDay(todayIso())}>Hoy</button>}
      </div>

      {/* Apertura */}
      <div className="card">
        <h2>Apertura</h2>
        {session ? (
          <div className="row">
            <p style={{ margin: 0 }} className="spacer">Empezó con <strong>{formatMoney(summary.opening)}</strong> en efectivo.</p>
            {!isClosed && opening === null && <button type="button" className="btn btn-chico no-print" onClick={() => setOpening(summary.opening)}>Corregir</button>}
          </div>
        ) : (
          <p className="muted">La caja de este día todavía no se abrió. Contá el efectivo con el que empezás (el cambio).</p>
        )}
        {(!session || opening !== null) && (
          <div className="row no-print">
            <div style={{ flex: '1 1 200px' }}>
              <Field label="Efectivo al empezar"><MoneyInput value={opening} onChange={setOpening} /></Field>
            </div>
            <button type="button" className="btn btn-principal" onClick={onOpen}><LockOpen size={20} aria-hidden="true" /> {session ? 'Guardar' : 'Abrir caja'}</button>
          </div>
        )}
      </div>

      {/* Ventas por forma de pago */}
      <div className="card">
        <h2>Ventas del día</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Forma de pago</th><th className="num">Ventas</th><th className="num">Total</th></tr></thead>
            <tbody>
              {summary.byMethod.map((m) => (
                <tr key={m.method}><td>{m.method}</td><td className="num">{m.count}</td><td className="num">{formatMoney(m.total)}</td></tr>
              ))}
              <tr><td><strong>Total vendido</strong></td><td className="num"><strong>{summary.salesCount}</strong></td><td className="num"><strong>{formatMoney(summary.salesTotal)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted no-print" style={{ marginTop: '0.5rem' }}><Link to="/ventas">Ver las ventas</Link></p>
      </div>

      {/* Movimientos manuales */}
      <div className="card">
        <h2>Entradas y salidas de efectivo</h2>
        <p className="small muted">Plata que entra o sale de la caja sin ser una venta: "compré bolsas", "retiro de efectivo", "agregué cambio".</p>
        {summary.moves.length > 0 && (
          <div className="list" style={{ marginBottom: '1rem' }}>
            {summary.moves.map((m) => (
              <div key={m.id} className="list-item">
                <div className="list-item-main">
                  <div className="list-item-title">{m.description}</div>
                  <div className="list-item-sub">{m.type === 'entrada' ? 'Entrada' : 'Salida'}</div>
                </div>
                <strong className={m.type === 'salida' ? 'texto-error' : ''}>{m.type === 'salida' ? '− ' : '+ '}{formatMoney(m.amount)}</strong>
                {!isClosed && <button type="button" className="btn btn-chico btn-texto no-print" onClick={() => onDeleteMove(m)} aria-label={`Borrar ${m.description}`}><Trash2 size={18} aria-hidden="true" /> Borrar</button>}
              </div>
            ))}
          </div>
        )}
        {summary.cashExpenses > 0 && (
          <p className="small">Gastos pagados con plata de la caja: <strong>− {formatMoney(summary.cashExpenses)}</strong> (<Link to="/gastos">ver gastos</Link>)</p>
        )}
        {!isClosed && (
          <div className="no-print">
            <ChoiceGroup value={move.type} onChange={(v) => setMove({ ...move, type: v })} options={[{ value: 'salida', label: 'Salida' }, { value: 'entrada', label: 'Entrada' }]} />
            <div className="row" style={{ marginTop: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 200px' }}><Field label="Descripción"><TextInput value={move.description} onChange={(v) => setMove({ ...move, description: v })} placeholder="Compré bolsas" /></Field></div>
              <div style={{ flex: '1 1 140px' }}><Field label="Monto"><MoneyInput value={move.amount} onChange={(v) => setMove({ ...move, amount: v })} /></Field></div>
              <div className="field"><button type="button" className="btn" onClick={onAddMove}><Plus size={20} aria-hidden="true" /> Anotar</button></div>
            </div>
          </div>
        )}
      </div>

      {/* Cierre */}
      <div className="card">
        <h2>Cierre</h2>
        <div className="totals">
          <div className="totals-row"><span>Efectivo al empezar</span><span>{formatMoney(summary.opening)}</span></div>
          <div className="totals-row"><span>+ Ventas en efectivo</span><span>{formatMoney(summary.cashSales)}</span></div>
          {summary.inflow > 0 && <div className="totals-row"><span>+ Entradas</span><span>{formatMoney(summary.inflow)}</span></div>}
          {summary.outflow > 0 && <div className="totals-row"><span>− Salidas</span><span>{formatMoney(summary.outflow)}</span></div>}
          {summary.cashExpenses > 0 && <div className="totals-row"><span>− Gastos pagados con la caja</span><span>{formatMoney(summary.cashExpenses)}</span></div>}
          <div className="totals-row totals-final"><span>Debería haber</span><span>{formatMoney(summary.expected)}</span></div>
        </div>

        {isClosed ? (
          <>
            <div className="totals-row" style={{ marginTop: '0.75rem', fontSize: '1.15rem' }}><span>Contado</span><strong>{formatMoney(summary.counted)}</strong></div>
            {diff === 0 && <Notice type="ok">La caja da justo.</Notice>}
            {diff > 0 && <Notice type="aviso">Sobran {formatMoney(diff)}.</Notice>}
            {diff < 0 && <Notice type="error">Faltan {formatMoney(-diff)}.</Notice>}
            <button type="button" className="btn btn-chico no-print" onClick={() => reopenCash(day)}><LockOpen size={18} aria-hidden="true" /> Reabrir caja</button>
          </>
        ) : (
          <div className="row no-print" style={{ marginTop: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <Field label="¿Cuánto efectivo hay? (contalo)"><MoneyInput value={counted} onChange={setCounted} /></Field>
            </div>
            <div className="field"><button type="button" className="btn btn-principal" onClick={onClose}><Lock size={20} aria-hidden="true" /> Cerrar caja</button></div>
          </div>
        )}
        {error && <Notice type="error">{error}</Notice>}
      </div>
    </>
  );
}

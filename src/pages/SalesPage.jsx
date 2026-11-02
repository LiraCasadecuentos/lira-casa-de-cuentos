// Historial de ventas, por día.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSales } from '../ui/useData.js';
import { Checkbox, EmptyState } from '../ui/components.jsx';
import { dayOf, isActiveSale, summarizeSales } from '../logic/sales.js';
import { formatMoney } from '../logic/money.js';
import { todayIso, toDateInput, formatDate } from '../db/ids.js';
import ReportActions from '../ui/ReportActions.jsx';
import PrintHeader from '../ui/PrintHeader.jsx';

function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toDateInput(d);
}

export default function SalesPage() {
  const sales = useSales();
  const [day, setDay] = useState(todayIso());
  const [allDays, setAllDays] = useState(false);
  if (!sales) return null;

  const list = allDays ? sales.slice(0, 200) : sales.filter((s) => dayOf(s.date) === day);
  const summary = allDays ? null : summarizeSales(sales, day, day);

  return (
    <>
      <div className="page-header">
        <h1>Ventas</h1>
        <Link to="/vender" className="btn btn-principal"><ShoppingBag size={22} aria-hidden="true" /> Cargar venta</Link>
      </div>

      <div className="card row">
        <button type="button" className="btn btn-chico" onClick={() => setDay(shiftDay(day, -1))} disabled={allDays} aria-label="Día anterior"><ChevronLeft size={20} aria-hidden="true" /> Anterior</button>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value || todayIso())} disabled={allDays} style={{ flex: '1 1 160px', width: 'auto' }} aria-label="Día" />
        <button type="button" className="btn btn-chico" onClick={() => setDay(shiftDay(day, 1))} disabled={allDays} aria-label="Día siguiente">Siguiente <ChevronRight size={20} aria-hidden="true" /></button>
        {day !== todayIso() && !allDays && <button type="button" className="btn btn-chico btn-texto" onClick={() => setDay(todayIso())}>Hoy</button>}
        <Checkbox checked={allDays} onChange={setAllDays}>Ver las últimas de todos los días</Checkbox>
      </div>

      <PrintHeader title="Ventas" subtitle={allDays ? 'Últimas ventas' : formatDate(day)} />
      <ReportActions
        build={() => ({
          filename: allDays ? 'ventas.xlsx' : `ventas-${day}.xlsx`,
          sheets: [{
            name: 'Ventas',
            rows: [['Fecha', 'Hora', 'Productos', 'Forma de pago', 'Canal', 'Cliente', 'Descuento', 'Envío', 'Total', 'Ganancia bruta', 'Estado'],
              ...list.map((s) => [formatDate(dayOf(s.date)), s.date.slice(11, 16), s.items.map((i) => `${i.qty}× ${i.name}`).join(', '), s.paymentMethod, s.channel, s.customer, s.totals.discount, s.totals.shipping, s.totals.total, s.totals.profit, isActiveSale(s) ? 'Confirmada' : 'Anulada'])],
            widths: [12, 7, 50, 15, 12, 18, 11, 10, 12, 14, 11],
          }],
        })}
      />
      {summary && (
        <div className="grid">
          <div className="card"><div className="stat-label">Ventas del {formatDate(day)}</div><div className="stat-value">{summary.count}</div></div>
          <div className="card"><div className="stat-label">Total cobrado</div><div className="stat-value">{formatMoney(summary.total)}</div>{summary.shipping > 0 && <div className="small muted">incluye {formatMoney(summary.shipping)} de envíos</div>}</div>
          <div className="card"><div className="stat-label">Ganancia bruta</div><div className="stat-value">{formatMoney(summary.profit)}</div><div className="small muted">Ventas menos costo de los productos</div></div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState title={allDays ? 'Todavía no hay ventas' : 'No hay ventas este día'}>Las ventas que cargues van a aparecer acá.</EmptyState>
      ) : (
        <div className="list">
          {list.map((s) => (
            <Link key={s.id} to={`/ventas/${s.id}`} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">
                  {s.items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.name}`).join(', ')}
                </div>
                <div className="list-item-sub">
                  {allDays ? `${formatDate(dayOf(s.date))} ` : ''}{s.date.slice(11, 16)} · {s.paymentMethod}{s.channel ? ` · ${s.channel}` : ''}{s.customer ? ` · ${s.customer}` : ''}
                </div>
              </div>
              <div className="list-item-side">
                <strong style={isActiveSale(s) ? undefined : { textDecoration: 'line-through' }}>{formatMoney(s.totals.total)}</strong>
                {!isActiveSale(s) && <div><span className="badge badge-sin">Anulada</span></div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

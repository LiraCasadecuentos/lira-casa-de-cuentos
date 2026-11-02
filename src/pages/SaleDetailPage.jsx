// Detalle de una venta: ver, editar o anular (con registro de cambios).

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Ban } from 'lucide-react';
import { db } from '../db/db.js';
import { voidSale } from '../db/sales.js';
import { Field, TextInput, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { isActiveSale, dayOf } from '../logic/sales.js';
import { formatMoney } from '../logic/money.js';
import { formatDate } from '../db/ids.js';

export default function SaleDetailPage() {
  const { id } = useParams();
  const sale = useLiveQuery(() => db.sales.get(id), [id]);
  const toast = useToast();
  const confirm = useConfirm();
  const [reason, setReason] = useState('');

  if (sale === undefined) return null;
  if (!sale || sale.deleted) return <Notice type="error">No encontramos esta venta. <Link to="/ventas">Volver a ventas</Link></Notice>;

  const active = isActiveSale(sale);
  const t = sale.totals;

  async function onVoid() {
    const ok = await confirm({
      title: '¿Anular esta venta?',
      message: `La venta de ${formatMoney(t.total)} deja de contar y los productos vuelven al stock. Queda guardada como "anulada".`,
      confirmText: 'Sí, anular',
      danger: true,
    });
    if (!ok) return;
    await voidSale(sale.id, reason.trim());
    toast('Venta anulada');
  }

  return (
    <>
      <div className="page-header">
        <h1>Venta del {formatDate(dayOf(sale.date))} {sale.date.slice(11, 16)}</h1>
        <Link to="/ventas" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
      </div>

      {!active && <Notice type="error">Esta venta está anulada. No cuenta en el stock ni en los totales.</Notice>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
            <tbody>
              {sale.items.map((i) => (
                <tr key={i.productId}>
                  <td><Link to={`/productos/${i.productId}`}>{i.name}</Link></td>
                  <td className="num">{i.qty}</td>
                  <td className="num">{formatMoney(i.unitPrice)}</td>
                  <td className="num">{formatMoney(i.qty * i.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals" style={{ marginTop: '1rem' }}>
          <div className="totals-row"><span>Productos</span><span>{formatMoney(t.subtotal)}</span></div>
          {t.discount > 0 && <div className="totals-row"><span>Descuento</span><span>− {formatMoney(t.discount)}</span></div>}
          {t.shipping > 0 && <div className="totals-row muted"><span>Envío (aparte)</span><span>+ {formatMoney(t.shipping)}</span></div>}
          <div className="totals-row totals-final"><span>Total cobrado</span><span>{formatMoney(t.total)}</span></div>
          <div className="totals-row muted small"><span>Ganancia bruta (sin contar el envío)</span><span>{formatMoney(t.profit)}</span></div>
        </div>
      </div>

      <div className="card">
        <p><strong>Forma de pago:</strong> {sale.paymentMethod}</p>
        <p><strong>Canal:</strong> {sale.channel || '—'}{sale.mode === 'feria' ? ' (modo feria)' : ''}</p>
        {sale.shipping?.mode && <p><strong>Entrega:</strong> {sale.shipping.mode === 'envio' ? 'Envío' : 'Retira'}</p>}
        {sale.customer && <p><strong>Cliente:</strong> {sale.customer}</p>}
        {sale.note && <p><strong>Nota:</strong> {sale.note}</p>}
      </div>

      {active && (
        <div className="card no-print">
          <div className="row">
            <Link to={`/ventas/${sale.id}/editar`} className="btn btn-principal"><Pencil size={20} aria-hidden="true" /> Editar venta</Link>
          </div>
          <h3>Anular</h3>
          <p className="small muted">Si la venta no se hizo o se cargó por error. Los productos vuelven al stock.</p>
          <div className="row">
            <div style={{ flex: '1 1 220px' }}>
              <Field label="Motivo (opcional)"><TextInput value={reason} onChange={setReason} placeholder="Se cargó dos veces" /></Field>
            </div>
            <button type="button" className="btn btn-peligro" onClick={onVoid}><Ban size={20} aria-hidden="true" /> Anular venta</button>
          </div>
        </div>
      )}

      {sale.history?.length > 0 && (
        <div className="card">
          <h2>Registro de cambios</h2>
          <ul>
            {sale.history.map((h, i) => (
              <li key={i}><strong>{formatDate(h.at)} {new Date(h.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</strong>: {h.action}. {h.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

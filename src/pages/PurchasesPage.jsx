// Historial de compras, filtrable por fechas y proveedor.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import { usePurchases, useSuppliers, indexById } from '../ui/useData.js';
import { Field, EmptyState } from '../ui/components.jsx';
import { formatMoney } from '../logic/money.js';
import { formatDate, todayIso } from '../db/ids.js';
import ReportActions from '../ui/ReportActions.jsx';
import PrintHeader from '../ui/PrintHeader.jsx';

export function PaymentBadge({ purchase }) {
  if (purchase.paid) return <span className="badge">Pagada</span>;
  const overdue = purchase.dueDate && purchase.dueDate < todayIso();
  return <span className={`badge ${overdue ? 'badge-sin' : 'badge-bajo'}`}>{overdue ? 'Vencida' : 'A pagar'}{purchase.dueDate ? ` · ${formatDate(purchase.dueDate)}` : ''}</span>;
}

export default function PurchasesPage() {
  const purchases = usePurchases();
  const suppliers = useSuppliers();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const supIndex = useMemo(() => indexById(suppliers), [suppliers]);
  if (!purchases || !suppliers) return null;

  const list = purchases.filter((p) =>
    (!from || p.date >= from) && (!to || p.date <= to) && (!supplierId || p.supplierId === supplierId) && (!onlyPending || !p.paid));
  const total = list.reduce((s, p) => s + p.total, 0);

  return (
    <>
      <div className="page-header">
        <h1>Compras</h1>
        <Link to="/compras/nueva" className="btn btn-principal"><PackagePlus size={22} aria-hidden="true" /> Cargar compra</Link>
      </div>

      <details className="filters" open={!!(from || to || supplierId || onlyPending) || undefined}>
        <summary className="btn btn-chico">Filtros</summary>
        <div className="grid-2" style={{ marginTop: '0.75rem' }}>
          <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Proveedor">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Todos</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <label className="checkbox" style={{ alignSelf: 'center' }}>
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Solo las que falta pagar
          </label>
        </div>
      </details>

      <PrintHeader title="Compras" subtitle={[from && `Desde ${formatDate(from)}`, to && `hasta ${formatDate(to)}`, supIndex.get(supplierId)?.name].filter(Boolean).join(' ')} />
      <ReportActions
        build={() => ({
          filename: 'compras.xlsx',
          sheets: [
            {
              name: 'Compras',
              rows: [['Fecha', 'Proveedor', 'Factura', 'Unidades', 'Total', 'Estado', 'Vence'],
                ...list.map((p) => [formatDate(p.date), supIndex.get(p.supplierId)?.name || '', p.invoiceNumber || '', p.items.reduce((s, i) => s + Number(i.qty), 0), p.total, p.paid ? 'Pagada' : 'A pagar', p.dueDate ? formatDate(p.dueDate) : ''])],
              widths: [12, 30, 18, 10, 14, 10, 12],
            },
            {
              name: 'Detalle',
              rows: [['Fecha', 'Proveedor', 'Factura', 'Producto', 'Cantidad', 'Costo c/u', 'Subtotal'],
                ...list.flatMap((p) => p.items.map((i) => [formatDate(p.date), supIndex.get(p.supplierId)?.name || '', p.invoiceNumber || '', i.name || '', i.qty, i.unitCost, i.qty * i.unitCost]))],
              widths: [12, 30, 18, 45, 10, 12, 14],
            },
          ],
        })}
      />
      <p className="small muted">{list.length} {list.length === 1 ? 'compra' : 'compras'} · {formatMoney(total)}</p>

      {list.length === 0 ? (
        <EmptyState title="No hay compras para mostrar">Cuando llegue mercadería, cargala con "Cargar compra" y se suma sola al stock.</EmptyState>
      ) : (
        <div className="list">
          {list.map((p) => (
            <Link key={p.id} to={`/compras/${p.id}`} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">{supIndex.get(p.supplierId)?.name || 'Sin proveedor'}</div>
                <div className="list-item-sub">{formatDate(p.date)}{p.invoiceNumber ? ` · Factura ${p.invoiceNumber}` : ''} · {p.items.reduce((s, i) => s + Number(i.qty), 0)} unidades</div>
              </div>
              <div className="list-item-side">
                <strong>{formatMoney(p.total)}</strong>
                <div><PaymentBadge purchase={p} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

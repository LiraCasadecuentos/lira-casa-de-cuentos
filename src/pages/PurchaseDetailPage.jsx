// Detalle de una compra: productos, pago y anulación.

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Ban, CircleCheck } from 'lucide-react';
import { db } from '../db/db.js';
import { setPurchasePaid, voidPurchase } from '../db/purchases.js';
import { Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { formatMoney, formatPercent } from '../logic/money.js';
import { formatDate } from '../db/ids.js';
import { PaymentBadge } from './PurchasesPage.jsx';

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const purchase = useLiveQuery(() => db.purchases.get(id), [id]);
  const supplier = useLiveQuery(() => (purchase?.supplierId ? db.suppliers.get(purchase.supplierId) : null), [purchase?.supplierId]);

  if (purchase === undefined) return null;
  if (!purchase || purchase.deleted) return <Notice type="error">No encontramos esta compra. <Link to="/compras">Volver a compras</Link></Notice>;

  async function onTogglePaid() {
    await setPurchasePaid(purchase.id, !purchase.paid);
    toast(purchase.paid ? 'Marcada como pendiente' : 'Marcada como pagada');
  }

  async function onVoid() {
    const ok = await confirm({
      title: '¿Anular esta compra?',
      message: 'Usalo solo si se cargó por error. Las unidades de esta compra se restan del stock. El costo de los productos no cambia (se corrige en cada ficha si hace falta).',
      confirmText: 'Sí, anular',
      danger: true,
    });
    if (!ok) return;
    await voidPurchase(purchase.id);
    toast('Compra anulada');
    navigate('/compras');
  }

  return (
    <>
      <div className="page-header">
        <h1>Compra del {formatDate(purchase.date)}</h1>
        <Link to="/compras" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
      </div>

      <div className="card">
        <p><strong>Proveedor:</strong> {supplier ? <Link to={`/proveedores/${supplier.id}`}>{supplier.name}</Link> : 'Sin proveedor'}</p>
        {purchase.invoiceNumber && <p><strong>Factura:</strong> {purchase.invoiceNumber}</p>}
        <p><strong>Pago:</strong> <PaymentBadge purchase={purchase} /></p>
        {purchase.notes && <p><strong>Notas:</strong> {purchase.notes}</p>}
        <div className="row no-print">
          <button type="button" className="btn" onClick={onTogglePaid}>
            <CircleCheck size={20} aria-hidden="true" /> {purchase.paid ? 'Marcar como pendiente de pago' : 'Marcar como pagada'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Factura</th><th className="num">Costo c/u</th><th className="num">Subtotal</th></tr></thead>
            <tbody>
              {purchase.items.map((i) => (
                <tr key={i.productId}>
                  <td><Link to={`/productos/${i.productId}`}>{i.name || 'Producto'}</Link></td>
                  <td className="num">{i.qty}</td>
                  <td className="num small">
                    {i.listPrice ? `PVP ${formatMoney(i.listPrice)} − ${formatPercent(i.supplierDiscount)}` : i.invoiceCost ? formatMoney(i.invoiceCost) : '—'}
                  </td>
                  <td className="num">{formatMoney(i.unitCost)}</td>
                  <td className="num">{formatMoney(i.qty * i.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals-row totals-final" style={{ marginTop: '0.75rem' }}><span>Total</span><span>{formatMoney(purchase.total)}</span></div>
      </div>

      <div className="card no-print">
        <h3>¿Se cargó por error?</h3>
        <button type="button" className="btn btn-peligro" onClick={onVoid}><Ban size={20} aria-hidden="true" /> Anular compra</button>
      </div>
    </>
  );
}

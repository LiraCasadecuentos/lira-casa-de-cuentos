// Lista de informes disponibles.

import { Link } from 'react-router-dom';
import { BarChart3, Megaphone, Wallet, Trophy, Snail, PiggyBank, Package, ClipboardList, Handshake } from 'lucide-react';
import { useSettings } from '../../ui/useData.js';

export const REPORTS = [
  { slug: 'ventas', title: 'Ventas por período', help: 'Cuánto se vendió por día, semana o mes.', icon: BarChart3 },
  { slug: 'ganancias', title: 'Ganancias', help: 'Ganancia bruta y neta (restando gastos).', icon: PiggyBank },
  { slug: 'canales', title: 'Ventas por canal', help: 'Instagram, WhatsApp, feria, local: cuál rinde más.', icon: Megaphone },
  { slug: 'pagos', title: 'Ventas por forma de pago', help: 'Efectivo, transferencia, Mercado Pago.', icon: Wallet },
  { slug: 'mas-vendidos', title: 'Lo más vendido', help: 'Por cantidad y por ganancia.', icon: Trophy },
  { slug: 'sin-ventas', title: 'Lo que no se vende', help: 'Productos con stock parado.', icon: Snail },
  { slug: 'stock', title: 'Stock disponible', help: 'Valor del inventario a costo y a precio de venta.', icon: Package },
  { slug: 'reponer', title: 'Lo que hay que reponer', help: 'Stock bajo, agrupado por proveedor, para imprimir.', icon: ClipboardList },
  // Solo aparece si en Configuración está activado "Usamos productos en consignación".
  { slug: 'consignaciones', title: 'Consignaciones a pagar', help: 'Cuánto se vendió de cada proveedor y cuánto se le debe.', icon: Handshake, consignment: true },
];

export default function ReportsIndexPage() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <>
      <h1>Informes</h1>
      <p className="muted">Todos se pueden descargar en Excel e imprimir.</p>
      <div className="report-cards">
        {REPORTS.filter((r) => !r.consignment || settings.useConsignment).map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.slug} to={`/informes/${r.slug}`} className="card report-card">
              <Icon size={28} aria-hidden="true" />
              <div>
                <div className="list-item-title">{r.title}</div>
                <div className="small muted">{r.help}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

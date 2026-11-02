import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingBag, Plus, FileSpreadsheet, ShieldCheck, Sparkles, Tent, Banknote } from 'lucide-react';
import { useProducts, useStockMap, useSettings, useDevice, useSales, usePurchases, useSuppliers, indexById } from '../ui/useData.js';
import { summarizeSales, weekStart } from '../logic/sales.js';
import { duePurchases } from '../db/purchases.js';
import { todayIso, formatDate } from '../db/ids.js';
import { Notice } from '../ui/components.jsx';
import { isLowStock } from '../logic/stock.js';
import { formatMoney } from '../logic/money.js';
import { daysSince } from '../db/backup.js';
import { hasSampleData, loadSampleData } from '../db/sample.js';
import { useToast } from '../ui/feedback.jsx';

export default function HomePage() {
  const products = useProducts();
  const stockMap = useStockMap();
  const settings = useSettings();
  const device = useDevice();
  const sample = useLiveQuery(() => hasSampleData(), []);
  const toast = useToast();
  const sales = useSales();
  const purchases = usePurchases();
  const suppliers = useSuppliers();

  if (!products || !stockMap || !settings || !device || !sales || !purchases || !suppliers) return null;

  const today = todayIso();
  const todayStats = summarizeSales(sales, today, today);
  const weekStats = summarizeSales(sales, weekStart(today), today);
  const due = duePurchases(purchases, today);
  const supIndex = indexById(suppliers);

  const active = products.filter((p) => p.active !== false);
  const low = active.filter((p) => isLowStock(p, stockMap.get(p.id) || 0));
  const units = active.reduce((s, p) => s + Math.max(0, stockMap.get(p.id) || 0), 0);
  const value = active.reduce((s, p) => s + Math.max(0, stockMap.get(p.id) || 0) * (p.salePrice || 0), 0);
  const backupDays = daysSince(device.lastBackupAt);
  const needsBackup = active.length > 0 && (backupDays === null || backupDays >= settings.backupReminderDays);

  async function onLoadSample() {
    await loadSampleData();
    toast('Listo, se cargaron los datos de ejemplo');
  }

  return (
    <>
      <h1>¡Hola!</h1>

      {needsBackup && (
        <Notice type="aviso">
          {backupDays === null
            ? 'Todavía no hiciste ningún respaldo de este dispositivo. '
            : `Hace ${backupDays} días que no hacés un respaldo. `}
          <Link to="/respaldo">Hacer respaldo ahora</Link>
        </Notice>
      )}

      {active.length === 0 && (
        <div className="card">
          <h2>Para empezar</h2>
          <p>Todavía no hay productos cargados. Podés:</p>
          <div className="row">
            <Link to="/importar" className="btn btn-principal"><FileSpreadsheet size={22} aria-hidden="true" /> Importar desde Excel</Link>
            <Link to="/productos/nuevo" className="btn"><Plus size={22} aria-hidden="true" /> Cargar un producto</Link>
            {!sample && (
              <button type="button" className="btn" onClick={onLoadSample}><Sparkles size={22} aria-hidden="true" /> Probar con datos de ejemplo</button>
            )}
          </div>
        </div>
      )}

      {sample && (
        <Notice type="info">
          Estás viendo datos de ejemplo. Cuando quieras empezar en serio, borralos desde <Link to="/configuracion">Configuración</Link>.
        </Notice>
      )}

      {due.map((p) => (
        <Notice key={p.id} type={p.overdue ? 'error' : 'aviso'}>
          {p.overdue ? 'Vencida' : 'Por vencer'}: compra a {supIndex.get(p.supplierId)?.name || 'un proveedor'} de {formatMoney(p.total)}, vence el {formatDate(p.dueDate)}. <Link to={`/compras/${p.id}`}>Ver compra</Link>
        </Notice>
      ))}

      <div className="row no-print" style={{ marginBottom: '1rem' }}>
        <Link to="/vender" className="btn btn-principal btn-grande" style={{ flex: '2 1 220px' }}><ShoppingBag size={26} aria-hidden="true" /> Cargar venta</Link>
        <Link to="/feria" className="btn btn-grande" style={{ flex: '1 1 160px' }}><Tent size={24} aria-hidden="true" /> Modo feria</Link>
        <Link to="/caja" className="btn btn-grande" style={{ flex: '1 1 160px' }}><Banknote size={24} aria-hidden="true" /> Caja del día</Link>
      </div>

      <div className="grid">
        <Link to="/ventas" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-label">Ventas de hoy</div>
          <div className="stat-value">{formatMoney(todayStats.total)}</div>
          <div className="small muted">{todayStats.count} {todayStats.count === 1 ? 'venta' : 'ventas'}</div>
        </Link>
        <div className="card">
          <div className="stat-label">Ventas de esta semana</div>
          <div className="stat-value">{formatMoney(weekStats.total)}</div>
          <div className="small muted">{weekStats.count} {weekStats.count === 1 ? 'venta' : 'ventas'} desde el lunes</div>
        </div>
        <div className="card">
          <div className="stat-label">Stock: {units} unidades</div>
          <div className="stat-value">{formatMoney(value)}</div>
          <div className="small muted">a precio de venta · {active.length} productos</div>
        </div>
      </div>

      <h2>Stock bajo</h2>
      {low.length === 0 ? (
        <p className="muted">No hay productos con stock bajo.</p>
      ) : (
        <div className="list">
          {low.slice(0, 8).map((p) => {
            const stock = stockMap.get(p.id) || 0;
            return (
              <Link key={p.id} to={`/productos/${p.id}`} className="list-item">
                <div className="list-item-main">
                  <div className="list-item-title">{p.name}</div>
                  <div className="list-item-sub">Mínimo: {p.stockMin ?? 0}</div>
                </div>
                <span className={`badge ${stock <= 0 ? 'badge-sin' : 'badge-bajo'}`}>{stock <= 0 ? 'Sin stock' : `Quedan ${stock}`}</span>
              </Link>
            );
          })}
          {low.length > 8 && <Link to="/productos?filtro=bajo" className="btn">Ver los {low.length} productos con stock bajo</Link>}
        </div>
      )}

      {!needsBackup && active.length > 0 && (
        <p className="small muted" style={{ marginTop: '2rem' }}>
          <ShieldCheck size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Último respaldo: {backupDays === 0 ? 'hoy' : `hace ${backupDays} ${backupDays === 1 ? 'día' : 'días'}`}.
        </p>
      )}
    </>
  );
}

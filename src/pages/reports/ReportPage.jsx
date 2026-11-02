// Cada informe. La ruta /informes/:tipo elige cuál mostrar.
// Los cálculos están en logic/reports.js; acá solo se muestran y se arman los Excel.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../../db/db.js';
import { useSales, useProducts, useStockMap, useSuppliers, useCategories, indexById } from '../../ui/useData.js';
import PeriodPicker, { usePeriod } from '../../ui/PeriodPicker.jsx';
import ReportActions from '../../ui/ReportActions.jsx';
import PrintHeader from '../../ui/PrintHeader.jsx';
import { TimeChart, HBars } from '../../ui/Charts.jsx';
import { ChoiceGroup, Notice, EmptyState, NumberInput } from '../../ui/components.jsx';
import { salesOverTime, salesGroupedBy, productRanking, unsoldProducts, profitReport, stockReport, restockList, salesInRange } from '../../logic/reports.js';
import { formatMoney, formatPercent } from '../../logic/money.js';
import { consignmentReport } from '../../logic/consignment.js';
import { todayIso, formatDate } from '../../db/ids.js';
import { REPORTS } from './ReportsIndexPage.jsx';

const pct = (v) => formatPercent(v, 0);

function Frame({ slug, subtitle, children }) {
  const info = REPORTS.find((r) => r.slug === slug);
  return (
    <>
      <PrintHeader title={info.title} subtitle={subtitle} />
      <div className="page-header">
        <h1>{info.title}</h1>
        <Link to="/informes" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Informes</Link>
      </div>
      {children}
    </>
  );
}

function Stat({ label, value, help }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {help && <div className="small muted">{help}</div>}
    </div>
  );
}

// ---------- Ventas por período ----------
/** Para los gráficos y tablas por día: no mostrar días que todavía no pasaron. */
const untilToday = (from, to) => (to > todayIso() && from <= todayIso() ? todayIso() : to);

function SalesReport({ sales }) {
  const period = usePeriod('mes');
  const { from, to, label } = period.range;
  const { rows, byMonth } = salesOverTime(sales, from, untilToday(from, to));
  const shippingTotal = salesInRange(sales, from, to).reduce((s, x) => s + x.totals.shipping, 0);
  const inRange = salesInRange(sales, from, to);
  const total = inRange.reduce((s, x) => s + x.totals.total, 0);
  const profit = inRange.reduce((s, x) => s + x.totals.profit, 0);
  const units = inRange.reduce((s, x) => s + x.totals.units, 0);
  const unit = byMonth ? 'Mes' : 'Día';

  const excel = () => ({
    filename: `ventas-${from}-a-${to}.xlsx`,
    sheets: [
      { name: `Por ${unit.toLowerCase()}`, rows: [[unit, 'Ventas', 'Total', 'Ganancia bruta'], ...rows.map((r) => [byMonth ? r.key : formatDate(r.key), r.count, r.total, r.profit])], widths: [14, 10, 16, 16] },
      {
        name: 'Detalle',
        rows: [['Fecha', 'Hora', 'Productos', 'Forma de pago', 'Canal', 'Cliente', 'Descuento', 'Envío', 'Total', 'Ganancia bruta'],
          ...inRange.slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => [formatDate(s.date.slice(0, 10)), s.date.slice(11, 16), s.items.map((i) => `${i.qty}× ${i.name}`).join(', '), s.paymentMethod, s.channel, s.customer, s.totals.discount, s.totals.shipping, s.totals.total, s.totals.profit])],
        widths: [12, 7, 50, 15, 12, 18, 11, 10, 12, 14],
      },
    ],
  });

  return (
    <Frame slug="ventas" subtitle={label}>
      <PeriodPicker period={period} />
      <ReportActions build={excel} />
      <div className="grid">
        <Stat label="Total cobrado" value={formatMoney(total)} help={`${inRange.length} ventas · ${units} unidades${shippingTotal ? ` · incluye ${formatMoney(shippingTotal)} de envíos` : ''}`} />
        <Stat label="Venta promedio" value={formatMoney(inRange.length ? total / inRange.length : 0)} />
        <Stat label="Ganancia bruta" value={formatMoney(profit)} help="Ventas menos costo de los productos" />
      </div>
      {rows.length > 1 && <div className="card"><TimeChart data={rows.map((r) => ({ label: r.label, value: r.total }))} title={`Total vendido por ${unit.toLowerCase()}`} type={rows.length > 20 ? 'line' : 'bar'} /></div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>{unit}</th><th className="num">Ventas</th><th className="num">Total</th><th className="num">Ganancia bruta</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.count ? '' : 'row-off'}>
                <td>{byMonth ? r.label : formatDate(r.key)}</td><td className="num">{r.count}</td><td className="num">{formatMoney(r.total)}</td><td className="num">{formatMoney(r.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

// ---------- Por canal / por forma de pago ----------
function GroupReport({ sales, slug, field, what }) {
  const period = usePeriod('mes');
  const { from, to, label } = period.range;
  const rows = salesGroupedBy(sales, from, to, field);
  const excel = () => ({
    filename: `ventas-por-${slug}-${from}-a-${to}.xlsx`,
    sheets: [{ name: `Por ${what}`, rows: [[what, 'Ventas', 'Total', '% del total', 'Venta promedio', 'Ganancia bruta'], ...rows.map((r) => [r.key, r.count, r.total, Math.round(r.share), r.average, r.profit])], widths: [20, 10, 14, 12, 15, 15] }],
  });
  return (
    <Frame slug={slug} subtitle={label}>
      <PeriodPicker period={period} />
      <ReportActions build={excel} />
      {rows.length === 0 ? (
        <EmptyState title="No hay ventas en este período">Probá con otro período.</EmptyState>
      ) : (
        <>
          <div className="card"><HBars data={rows.map((r) => ({ label: r.key, value: r.total, detail: `${r.count} ${r.count === 1 ? 'venta' : 'ventas'} · ${pct(r.share)} del total · ganancia ${formatMoney(r.profit)}` }))} /></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{what}</th><th className="num">Ventas</th><th className="num">Total</th><th className="num">% del total</th><th className="num">Venta promedio</th><th className="num">Ganancia bruta</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}><td>{r.key}</td><td className="num">{r.count}</td><td className="num">{formatMoney(r.total)}</td><td className="num">{pct(r.share)}</td><td className="num">{formatMoney(r.average)}</td><td className="num">{formatMoney(r.profit)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Frame>
  );
}

// ---------- Lo más vendido ----------
function TopReport({ sales }) {
  const period = usePeriod('mes');
  const [by, setBy] = useState('qty');
  const { from, to, label } = period.range;
  const rows = productRanking(sales, from, to).sort((a, b) => b[by] - a[by]);
  const excel = () => ({
    filename: `lo-mas-vendido-${from}-a-${to}.xlsx`,
    sheets: [{ name: 'Lo más vendido', rows: [['Producto', 'Unidades', 'Vendido', 'Costo', 'Ganancia'], ...rows.map((r) => [r.name, r.qty, r.revenue, r.cost, r.profit])], widths: [45, 10, 14, 14, 14] }],
  });
  return (
    <Frame slug="mas-vendidos" subtitle={label}>
      <PeriodPicker period={period} />
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <ChoiceGroup value={by} onChange={setBy} options={[{ value: 'qty', label: 'Por cantidad' }, { value: 'profit', label: 'Por ganancia' }]} />
      </div>
      <ReportActions build={excel} />
      {rows.length === 0 ? (
        <EmptyState title="No hay ventas en este período">Probá con otro período.</EmptyState>
      ) : (
        <>
          <div className="card">
            <h2>Los 10 primeros {by === 'qty' ? 'por cantidad' : 'por ganancia'}</h2>
            <HBars data={rows.slice(0, 10).map((r) => ({ label: r.name, value: r[by] }))} format={by === 'qty' ? (v) => `${v} u.` : formatMoney} />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Producto</th><th className="num">Unidades</th><th className="num">Vendido</th><th className="num">Ganancia</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.productId}><td>{i + 1}</td><td><Link to={`/productos/${r.productId}`}>{r.name}</Link></td><td className="num">{r.qty}</td><td className="num">{formatMoney(r.revenue)}</td><td className="num">{formatMoney(r.profit)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">"Vendido" ya tiene descontados los descuentos de cada venta.</p>
        </>
      )}
    </Frame>
  );
}

// ---------- Lo que no se vende ----------
function UnsoldReport({ sales, products, stockMap }) {
  const [days, setDays] = useState(60);
  const today = todayIso();
  const rows = unsoldProducts(products, sales, stockMap, days || 1, today);
  const costValue = rows.reduce((s, r) => s + r.costValue, 0);
  const units = rows.reduce((s, r) => s + r.stock, 0);
  const excel = () => ({
    filename: `sin-ventas-${days}-dias.xlsx`,
    sheets: [{ name: `Sin ventas ${days} días`, rows: [['Producto', 'Stock', 'Última venta', 'Valor a costo', 'Valor a precio de venta'], ...rows.map((r) => [r.product.name, r.stock, r.lastSale ? formatDate(r.lastSale) : 'Nunca', r.costValue, r.saleValue])], widths: [45, 8, 14, 15, 22] }],
  });
  return (
    <Frame slug="sin-ventas" subtitle={`Sin ventas en los últimos ${days} días`}>
      <div className="card no-print">
        <span className="field-label">Sin ventas en los últimos…</span>
        <div className="row">
          <ChoiceGroup value={days} onChange={setDays} options={[30, 60, 90].map((d) => ({ value: d, label: `${d} días` }))} />
          <div style={{ width: 120 }}><NumberInput value={days} onChange={(v) => setDays(Math.max(1, Math.round(v || 1)))} aria-label="Cantidad de días" /></div>
        </div>
      </div>
      <ReportActions build={excel} />
      <div className="grid">
        <Stat label="Productos parados" value={rows.length} help={`${units} unidades`} />
        <Stat label="Plata parada (a costo)" value={formatMoney(costValue)} />
      </div>
      {rows.length === 0 ? (
        <Notice type="ok">Todos los productos con stock tuvieron alguna venta en los últimos {days} días.</Notice>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Producto</th><th className="num">Stock</th><th>Última venta</th><th className="num">Valor a costo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.id}><td><Link to={`/productos/${r.product.id}`}>{r.product.name}</Link></td><td className="num">{r.stock}</td><td>{r.lastSale ? formatDate(r.lastSale) : 'Nunca se vendió'}</td><td className="num">{formatMoney(r.costValue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  );
}

// ---------- Ganancias ----------
function ProfitReportView({ sales, expenses }) {
  const period = usePeriod('mes');
  const { from, to, label } = period.range;
  const r = profitReport(sales, expenses, from, to);
  const { rows, byMonth } = salesOverTime(sales, from, untilToday(from, to));
  const excel = () => ({
    filename: `ganancias-${from}-a-${to}.xlsx`,
    sheets: [
      {
        name: 'Ganancias',
        rows: [
          ['Concepto', 'Monto'],
          ['Vendido (productos, con descuentos)', r.sold],
          ['Costo de lo vendido', -r.cost],
          ['GANANCIA BRUTA', r.gross],
          ...r.expensesByCategory.map((e) => [`Gasto: ${e.category}`, -e.amount]),
          ['GANANCIA NETA', r.net],
          [],
          ['Envíos cobrados (aparte, no son ganancia)', r.shipping],
          ['Descuentos hechos', r.discounts],
        ],
        widths: [42, 16],
      },
      { name: `Por ${byMonth ? 'mes' : 'día'}`, rows: [[byMonth ? 'Mes' : 'Día', 'Ventas', 'Total', 'Ganancia bruta'], ...rows.map((x) => [byMonth ? x.key : formatDate(x.key), x.count, x.total, x.profit])], widths: [14, 10, 14, 16] },
    ],
  });
  return (
    <Frame slug="ganancias" subtitle={label}>
      <PeriodPicker period={period} />
      <ReportActions build={excel} />
      <div className="grid">
        <Stat label="Ganancia bruta" value={formatMoney(r.gross)} help="Lo vendido menos lo que costaron esos productos." />
        <Stat label="Ganancia neta" value={formatMoney(r.net)} help="La bruta menos los gastos anotados." />
      </div>
      <div className="card totals">
        <div className="totals-row"><span>Vendido ({r.count} ventas, ya con descuentos)</span><span>{formatMoney(r.sold)}</span></div>
        <div className="totals-row"><span>− Costo de lo vendido</span><span>{formatMoney(r.cost)}</span></div>
        <div className="totals-row totals-final"><span>Ganancia bruta</span><span>{formatMoney(r.gross)}</span></div>
        {r.expensesByCategory.map((e) => <div key={e.category} className="totals-row"><span>− {e.category}</span><span>{formatMoney(e.amount)}</span></div>)}
        {r.expensesByCategory.length === 0 && <div className="totals-row muted"><span>− Gastos (no hay anotados)</span><span>{formatMoney(0)}</span></div>}
        <div className="totals-row totals-final"><span>Ganancia neta</span><span>{formatMoney(r.net)}</span></div>
        {r.shipping > 0 && <p className="small muted" style={{ marginTop: '0.5rem' }}>Además se cobraron {formatMoney(r.shipping)} de envíos. No cuentan como ganancia.</p>}
      </div>
      <p className="small muted no-print">Los gastos se anotan en <Link to="/gastos">Gastos</Link>.</p>
      {rows.length > 1 && <div className="card"><TimeChart data={rows.map((x) => ({ label: x.label, value: x.profit }))} title={`Ganancia bruta por ${byMonth ? 'mes' : 'día'}`} type={rows.length > 20 ? 'line' : 'bar'} /></div>}
    </Frame>
  );
}

// ---------- Stock disponible ----------
function StockReportView({ products, stockMap, categories }) {
  const [categoryId, setCategoryId] = useState('');
  const catIndex = indexById(categories);
  const filtered = products.filter((p) => !categoryId || p.categoryId === categoryId);
  const r = stockReport(filtered, stockMap);
  const excel = () => ({
    filename: `stock-${todayIso()}.xlsx`,
    sheets: [{
      name: 'Stock',
      rows: [['Producto', 'Categoría', 'Código', 'Stock', 'Costo c/u', 'Precio c/u', 'Valor a costo', 'Valor a precio de venta'],
        ...r.rows.map((x) => [x.product.name, catIndex.get(x.product.categoryId)?.name || '', x.product.code || '', x.stock, x.product.cost, x.product.salePrice, x.costValue, x.saleValue]),
        [], ['Total', '', '', r.units, '', '', r.costValue, r.saleValue]],
      widths: [45, 16, 14, 8, 12, 12, 14, 20],
    }],
  });
  return (
    <Frame slug="stock" subtitle={`Al ${formatDate(todayIso())}${categoryId ? ` · ${catIndex.get(categoryId)?.name}` : ''}`}>
      <div className="card no-print">
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Categoría</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <ReportActions build={excel} />
      <div className="grid">
        <Stat label="Unidades" value={r.units} help={`${r.rows.length} productos`} />
        <Stat label="Valor a costo" value={formatMoney(r.costValue)} help="Lo que costó la mercadería que hay." />
        <Stat label="Valor a precio de venta" value={formatMoney(r.saleValue)} help="Lo que se cobraría si se vende todo." />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Costo c/u</th><th className="num">Precio c/u</th><th className="num">Valor a costo</th><th className="num">Valor a venta</th></tr></thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.product.id} className={x.stock <= 0 ? 'row-off' : ''}>
                <td><Link to={`/productos/${x.product.id}`}>{x.product.name}</Link></td><td className="num">{x.stock}</td><td className="num">{formatMoney(x.product.cost)}</td><td className="num">{formatMoney(x.product.salePrice)}</td><td className="num">{formatMoney(x.costValue)}</td><td className="num">{formatMoney(x.saleValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

// ---------- Para reponer ----------
function RestockReport({ products, stockMap, suppliers }) {
  const groups = restockList(products, stockMap, indexById(suppliers));
  const excel = () => ({
    filename: `para-reponer-${todayIso()}.xlsx`,
    sheets: [{ name: 'Para reponer', rows: [['Proveedor', 'Producto', 'Código', 'Stock', 'Mínimo', 'Pedir (sugerido)'], ...groups.flatMap((g) => g.rows.map((x) => [g.supplier, x.product.name, x.product.code || '', x.stock, x.min, x.suggested]))], widths: [30, 45, 14, 8, 8, 16] }],
  });
  return (
    <Frame slug="reponer" subtitle={`Al ${formatDate(todayIso())}`}>
      <ReportActions build={excel} />
      <p className="small muted">Productos con el stock mínimo o menos. "Pedir" es una sugerencia: lo que falta para tener el doble del mínimo.</p>
      {groups.length === 0 ? (
        <Notice type="ok">No hay nada para reponer.</Notice>
      ) : (
        groups.map((g) => (
          <div key={g.supplier} className="card">
            <h2>{g.supplier}</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>Código</th><th className="num">Stock</th><th className="num">Mínimo</th><th className="num">Pedir</th></tr></thead>
                <tbody>
                  {g.rows.map((x) => (
                    <tr key={x.product.id}><td>{x.product.name}</td><td>{x.product.code}</td><td className="num">{x.stock}</td><td className="num">{x.min}</td><td className="num"><strong>{x.suggested}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </Frame>
  );
}

// ---------- Consignaciones a pagar ----------
function ConsignmentReportView({ sales, products, suppliers }) {
  const period = usePeriod('mes');
  const { from, to, label } = period.range;
  const groups = consignmentReport(sales, from, to, indexById(products), indexById(suppliers));
  const totalOwed = groups.reduce((s, g) => s + g.owed, 0);
  const excel = () => ({
    filename: `consignaciones-${from}-a-${to}.xlsx`,
    sheets: [{
      name: 'Consignaciones',
      rows: [['Proveedor', 'Producto', 'Unidades vendidas', 'Cobrado', 'Le corresponde', 'A pagar'],
        ...groups.flatMap((g) => [...g.rows.map((r) => [g.supplier, r.name, r.qty, r.charged, r.rule, r.missing ? 'Sin definir' : r.owed]), [g.supplier, 'TOTAL', g.units, g.charged, '', g.owed], []])],
      widths: [30, 45, 16, 14, 16, 14],
    }],
  });
  return (
    <Frame slug="consignaciones" subtitle={label}>
      <PeriodPicker period={period} />
      <ReportActions build={excel} />
      <p className="small muted">Ventas de productos marcados "en consignación". Elegí el período desde la última vez que les pagaron.</p>
      {groups.length === 0 ? (
        <EmptyState title="No hay ventas en consignación en este período">Los productos se marcan como "en consignación" en su ficha.</EmptyState>
      ) : (
        <>
          <div className="grid"><Stat label="Total a pagar" value={formatMoney(totalOwed)} help={`${groups.length} ${groups.length === 1 ? 'proveedor' : 'proveedores'}`} /></div>
          {groups.map((g) => (
            <div key={g.supplierId || 'sin'} className="card">
              <h2>{g.supplier}: {formatMoney(g.owed)}</h2>
              {g.undefinedUnits > 0 && <Notice type="aviso">{g.undefinedUnits} unidades vendidas no tienen definido cuánto le corresponde al proveedor. Completalo en la ficha de cada producto.</Notice>}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th className="num">Vendidos</th><th className="num">Cobrado</th><th>Le corresponde</th><th className="num">A pagar</th></tr></thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.productId}><td>{r.name}</td><td className="num">{r.qty}</td><td className="num">{formatMoney(r.charged)}</td><td>{r.rule}</td><td className="num">{r.missing ? '—' : formatMoney(r.owed)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </Frame>
  );
}

export default function ReportPage() {
  const { tipo } = useParams();
  const sales = useSales();
  const products = useProducts();
  const stockMap = useStockMap();
  const suppliers = useSuppliers();
  const categories = useCategories();
  const expenses = useLiveQuery(() => db.expenses.toArray(), []);
  const activeProducts = useMemo(() => (products || []).filter((p) => p.active !== false), [products]);

  if (!sales || !products || !stockMap || !suppliers || !categories || !expenses) return null;

  switch (tipo) {
    case 'ventas': return <SalesReport sales={sales} />;
    case 'canales': return <GroupReport sales={sales} slug="canales" field="channel" what="Canal" />;
    case 'pagos': return <GroupReport sales={sales} slug="pagos" field="paymentMethod" what="Forma de pago" />;
    case 'mas-vendidos': return <TopReport sales={sales} />;
    case 'sin-ventas': return <UnsoldReport sales={sales} products={activeProducts} stockMap={stockMap} />;
    case 'ganancias': return <ProfitReportView sales={sales} expenses={expenses} />;
    case 'stock': return <StockReportView products={activeProducts} stockMap={stockMap} categories={categories} />;
    case 'reponer': return <RestockReport products={activeProducts} stockMap={stockMap} suppliers={suppliers} />;
    case 'consignaciones': return <ConsignmentReportView sales={sales} products={products} suppliers={suppliers} />;
    default: return <Notice type="error">No encontramos ese informe. <Link to="/informes">Ver informes</Link></Notice>;
  }
}

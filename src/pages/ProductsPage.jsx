import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Percent } from 'lucide-react';
import { useProducts, useCategories, useSuppliers, useStockMap, indexById } from '../ui/useData.js';
import { Checkbox, EmptyState } from '../ui/components.jsx';
import { matchesSearch } from '../logic/text.js';
import { formatMoney } from '../logic/money.js';
import { isLowStock } from '../logic/stock.js';
import { SEARCHABLE_EXTRA_KEYS } from '../db/defaults.js';
import ReportActions from '../ui/ReportActions.jsx';
import PrintHeader from '../ui/PrintHeader.jsx';

/** Textos en los que busca el buscador: nombre, código, autor, editorial, marca... */
export function searchFields(p) {
  return [p.name, p.code, ...SEARCHABLE_EXTRA_KEYS.map((k) => p.extras?.[k])];
}

export function StockBadge({ product, stock }) {
  if (product.trackStock === false) return null;
  if (stock <= 0) return <span className="badge badge-sin">Sin stock</span>;
  if (isLowStock(product, stock)) return <span className="badge badge-bajo">Stock: {stock} (bajo)</span>;
  return <span className="badge">Stock: {stock}</span>;
}

export default function ProductsPage() {
  const products = useProducts();
  const categories = useCategories();
  const suppliers = useSuppliers();
  const stockMap = useStockMap();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const categoryId = params.get('categoria') || '';
  const supplierId = params.get('proveedor') || '';
  const onlyLow = params.get('filtro') === 'bajo';

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const catIndex = useMemo(() => indexById(categories), [categories]);
  const supIndex = useMemo(() => indexById(suppliers), [suppliers]);

  const filtered = useMemo(() => {
    if (!products || !stockMap) return [];
    return products.filter((p) => {
      if (!showInactive && p.active === false) return false;
      if (categoryId && p.categoryId !== categoryId) return false;
      if (supplierId && p.supplierId !== supplierId) return false;
      if (onlyLow && !isLowStock(p, stockMap.get(p.id) || 0)) return false;
      return matchesSearch(query, searchFields(p));
    });
  }, [products, stockMap, query, categoryId, supplierId, onlyLow, showInactive]);

  if (!products || !categories || !suppliers || !stockMap) return null;

  const filtersOn = categoryId || supplierId || onlyLow;

  return (
    <>
      <div className="page-header">
        <h1>Productos</h1>
        <div className="row">
          <Link to="/precios" className="btn"><Percent size={20} aria-hidden="true" /> Actualizar precios</Link>
          <Link to="/productos/nuevo" className="btn btn-principal"><Plus size={22} aria-hidden="true" /> Nuevo producto</Link>
        </div>
      </div>

      <div className="search-box field">
        <Search size={22} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar: nombre, autor, marca…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar productos"
        />
      </div>

      <details className="filters" open={!!filtersOn || undefined}>
      <summary className="btn btn-chico">Filtros{filtersOn ? ' (activos)' : ''}</summary>
      <div className="grid-2" style={{ marginTop: '0.75rem' }}>
        <label className="field">
          <span className="field-label">Categoría</span>
          <select value={categoryId} onChange={(e) => setParam('categoria', e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Proveedor</span>
          <select value={supplierId} onChange={(e) => setParam('proveedor', e.target.value)}>
            <option value="">Todos</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <Checkbox checked={onlyLow} onChange={(v) => setParam('filtro', v ? 'bajo' : '')}>Solo stock bajo</Checkbox>
        <Checkbox checked={showInactive} onChange={setShowInactive}>Mostrar desactivados</Checkbox>
        {filtersOn && (
          <button type="button" className="btn btn-chico btn-texto" onClick={() => setParams({}, { replace: true })}>Quitar filtros</button>
        )}
      </div>
      </details>

      <PrintHeader title="Productos" subtitle={[catIndex.get(categoryId)?.name, supIndex.get(supplierId)?.name, onlyLow && 'Stock bajo'].filter(Boolean).join(' · ')} />
      <ReportActions
        build={() => ({
          filename: 'productos.xlsx',
          sheets: [{
            name: 'Productos',
            rows: [['Nombre', 'Categoría', 'Proveedor', 'Código', 'Autor / Marca', 'Editorial', 'Costo', 'Precio de venta', 'Stock', 'Stock mínimo'],
              ...filtered.map((p) => [p.name, catIndex.get(p.categoryId)?.name || '', supIndex.get(p.supplierId)?.name || '', p.code || '', p.extras?.autor || p.extras?.marca || '', p.extras?.editorial || '', p.cost, p.salePrice, stockMap.get(p.id) || 0, p.stockMin ?? ''])],
            widths: [45, 16, 22, 14, 22, 18, 12, 15, 8, 12],
          }],
        })}
      />
      <p className="small muted">{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}</p>

      {products.length === 0 ? (
        <EmptyState title="Todavía no hay productos">
          <p>Podés cargarlos de a uno o traerlos todos juntos desde un Excel.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/productos/nuevo" className="btn btn-principal">Cargar un producto</Link>
            <Link to="/importar" className="btn">Importar desde Excel</Link>
          </div>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="No encontramos nada">Probá con otra palabra o quitá los filtros.</EmptyState>
      ) : (
        <div className="list">
          {filtered.map((p) => {
            const extra = p.extras?.autor || p.extras?.marca || p.extras?.editorial;
            const sub = [extra, catIndex.get(p.categoryId)?.name, supIndex.get(p.supplierId)?.name].filter(Boolean).join(' · ');
            return (
              <Link key={p.id} to={`/productos/${p.id}`} className="list-item">
                <div className="list-item-main">
                  <div className="list-item-title">
                    {p.name} {p.active === false && <span className="badge">Desactivado</span>}
                    {p.ownership === 'consignacion' && <span className="badge badge-acento">Consignación</span>}
                  </div>
                  <div className="list-item-sub">{sub}</div>
                </div>
                <div className="list-item-side">
                  <div><strong>{formatMoney(p.salePrice)}</strong></div>
                  <StockBadge product={p} stock={stockMap.get(p.id) || 0} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// Buscador de productos para tocar y agregar (se usa en ventas y compras).

import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { matchesSearch } from '../logic/text.js';
import { formatMoney } from '../logic/money.js';
import { searchFields } from '../pages/ProductsPage.jsx';

/**
 * products     productos activos
 * stockMap     stock de cada producto
 * onPick       se llama con el producto tocado
 * grid         si es true, sin búsqueda muestra botones grandes con los productos (modo feria)
 * order        Map productId -> número para ordenar (por ejemplo, lo más vendido primero)
 * showCost     mostrar el costo en vez del precio (compras)
 * footer       algo para mostrar debajo de los resultados (por ejemplo "Crear producto nuevo")
 */
export default function ProductPicker({ products, stockMap, onPick, grid = false, order, showCost = false, autoFocus = false, footer = null, placeholder = 'Buscar producto para agregar' }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const list = products.filter((p) => p.active !== false && matchesSearch(query, searchFields(p)));
    if (order) list.sort((a, b) => (order.get(b.id) || 0) - (order.get(a.id) || 0) || a.name.localeCompare(b.name, 'es'));
    return list;
  }, [products, query, order]);

  const showList = query.trim().length > 0;
  const pick = (p) => {
    onPick(p);
    setQuery('');
  };

  return (
    <div className="picker">
      <div className="search-box">
        <Search size={22} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0 && showList) {
              e.preventDefault();
              pick(results[0]);
            }
          }}
        />
      </div>

      {showList && (
        <div className="list picker-results">
          {results.slice(0, 12).map((p) => {
            const stock = stockMap.get(p.id) || 0;
            return (
              <button type="button" key={p.id} className="list-item picker-item" onClick={() => pick(p)}>
                <Plus size={22} aria-hidden="true" />
                <div className="list-item-main">
                  <div className="list-item-title">{p.name}</div>
                  <div className="list-item-sub">{p.extras?.autor || p.extras?.marca || p.extras?.editorial || ''}</div>
                </div>
                <div className="list-item-side">
                  <strong>{formatMoney(showCost ? p.cost : p.salePrice)}</strong>
                  {p.trackStock !== false && (
                    <div className={`small ${stock <= 0 ? 'texto-error' : 'muted'}`}>{stock <= 0 ? 'Sin stock' : `Hay ${stock}`}</div>
                  )}
                </div>
              </button>
            );
          })}
          {results.length === 0 && <p className="muted" style={{ margin: '0.5rem 0' }}>No encontramos productos con "{query}".</p>}
          {results.length > 12 && <p className="small muted">Hay {results.length - 12} más. Escribí algo más para achicar la búsqueda.</p>}
          {footer}
        </div>
      )}

      {!showList && grid && (
        <div className="picker-grid">
          {results.slice(0, 24).map((p) => {
            const stock = stockMap.get(p.id) || 0;
            return (
              <button type="button" key={p.id} className="picker-tile" onClick={() => pick(p)}>
                <span className="picker-tile-name">{p.name}</span>
                <span className="picker-tile-price">{formatMoney(p.salePrice)}</span>
                {p.trackStock !== false && <span className={`small ${stock <= 0 ? 'texto-error' : 'muted'}`}>{stock <= 0 ? 'Sin stock' : `Hay ${stock}`}</span>}
              </button>
            );
          })}
        </div>
      )}
      {!showList && footer}
    </div>
  );
}

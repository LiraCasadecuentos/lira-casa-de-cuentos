import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { useProducts } from '../ui/useData.js';
import { formatPercent } from '../logic/money.js';

export default function CategoriesPage() {
  // Acá mostramos también las desactivadas, para poder reactivarlas.
  const categories = useLiveQuery(async () => (await db.categories.toArray()).filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name, 'es')), []);
  const products = useProducts();
  if (!categories || !products) return null;

  return (
    <>
      <div className="page-header">
        <h1>Categorías</h1>
        <Link to="/categorias/nueva" className="btn btn-principal"><Plus size={22} aria-hidden="true" /> Nueva categoría</Link>
      </div>
      <p className="muted">Cada categoría define qué datos extra se cargan en sus productos (por ejemplo, autor y editorial para los libros).</p>
      <div className="list">
        {categories.map((c) => {
          const count = products.filter((p) => p.categoryId === c.id).length;
          return (
            <Link key={c.id} to={`/categorias/${c.id}`} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">{c.name} {c.active === false && <span className="badge">Desactivada</span>}</div>
                <div className="list-item-sub">
                  {c.fields?.length ? `Datos extra: ${c.fields.map((f) => f.label).join(', ')}` : 'Sin datos extra'}
                  {c.defaultMarkup !== null && c.defaultMarkup !== undefined && ` · Recargo ${formatPercent(c.defaultMarkup)}`}
                </div>
              </div>
              <div className="list-item-side muted small">{count} {count === 1 ? 'producto' : 'productos'}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

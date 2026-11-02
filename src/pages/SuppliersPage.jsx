import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useSuppliers, useProducts, usePurchases } from '../ui/useData.js';
import { formatMoney } from '../logic/money.js';
import { EmptyState } from '../ui/components.jsx';
import { matchesSearch } from '../logic/text.js';

export default function SuppliersPage() {
  const suppliers = useSuppliers();
  const products = useProducts();
  const purchases = usePurchases();
  const [query, setQuery] = useState('');
  if (!suppliers || !products || !purchases) return null;
  // Cuenta corriente: lo que falta pagar a cada proveedor.
  const owed = purchases.filter((p) => !p.paid).reduce((m, p) => m.set(p.supplierId, (m.get(p.supplierId) || 0) + p.total), new Map());

  const filtered = suppliers.filter((s) => matchesSearch(query, [s.name, s.legalName, s.cuit]));

  return (
    <>
      <div className="page-header">
        <h1>Proveedores</h1>
        <Link to="/proveedores/nuevo" className="btn btn-principal"><Plus size={22} aria-hidden="true" /> Nuevo proveedor</Link>
      </div>

      {suppliers.length > 5 && (
        <div className="search-box field">
          <Search size={22} aria-hidden="true" />
          <input type="search" placeholder="Buscar proveedor" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar proveedor" />
        </div>
      )}

      {suppliers.length === 0 ? (
        <EmptyState title="Todavía no hay proveedores">
          <p>Cargalos acá, o se crean solos al importar un Excel.</p>
          <Link to="/proveedores/nuevo" className="btn btn-principal">Cargar proveedor</Link>
        </EmptyState>
      ) : (
        <div className="list">
          {filtered.map((s) => {
            const count = products.filter((p) => p.supplierId === s.id).length;
            return (
              <Link key={s.id} to={`/proveedores/${s.id}`} className="list-item">
                <div className="list-item-main">
                  <div className="list-item-title">{s.name}</div>
                  <div className="list-item-sub">{[s.phone, s.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</div>
                </div>
                <div className="list-item-side muted small">
                  {count} {count === 1 ? 'producto' : 'productos'}
                  {owed.get(s.id) > 0 && <div><span className="badge badge-bajo">A pagar {formatMoney(owed.get(s.id))}</span></div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

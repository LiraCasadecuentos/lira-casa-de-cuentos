// Estructura general: menú y pantallas.
// Usamos HashRouter (direcciones con #) porque funciona en GitHub Pages y sin internet.

import { useState } from 'react';
import { HashRouter, NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import ErrorBoundary from './ui/ErrorBoundary.jsx';
import MassPricesPage from './pages/MassPricesPage.jsx';
import { Home, BookOpen, Truck, Tags, FileSpreadsheet, ShieldCheck, Settings, Menu, X, ShoppingBag, Tent, Receipt, PackagePlus, Banknote, HandCoins, BarChart3 } from 'lucide-react';
import { FeedbackProvider } from './ui/feedback.jsx';
import { useSettings } from './ui/useData.js';
import { brand } from './theme/brand.js';

import HomePage from './pages/HomePage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ProductEditPage from './pages/ProductEditPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import CategoryEditPage from './pages/CategoryEditPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import SupplierEditPage from './pages/SupplierEditPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import BackupPage from './pages/BackupPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SalePage from './pages/SalePage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import SaleDetailPage from './pages/SaleDetailPage.jsx';
import PurchasesPage from './pages/PurchasesPage.jsx';
import PurchaseNewPage from './pages/PurchaseNewPage.jsx';
import PurchaseDetailPage from './pages/PurchaseDetailPage.jsx';
import CashPage from './pages/CashPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import ReportsIndexPage from './pages/reports/ReportsIndexPage.jsx';
import ReportPage from './pages/reports/ReportPage.jsx';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/vender', label: 'Vender', icon: ShoppingBag },
  { to: '/feria', label: 'Modo feria', icon: Tent },
  { to: '/ventas', label: 'Ventas', icon: Receipt },
  { to: '/caja', label: 'Caja del día', icon: Banknote },
  { to: '/compras', label: 'Compras', icon: PackagePlus },
  { to: '/gastos', label: 'Gastos', icon: HandCoins },
  { to: '/informes', label: 'Informes', icon: BarChart3 },
  { to: '/productos', label: 'Productos', icon: BookOpen },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/importar', label: 'Importar Excel', icon: FileSpreadsheet },
  { to: '/respaldo', label: 'Respaldo', icon: ShieldCheck },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];
// En el celular, abajo se ven solo estas; el resto queda en "Más".
const BOTTOM = ['/', '/vender', '/productos'];

function Brand() {
  const settings = useSettings();
  const full = settings?.businessName || `${brand.name}. ${brand.tagline}`;
  const [name, ...rest] = full.split('. ');
  return (
    <Link to="/" className="brand" aria-label={`${full}, ir al inicio`}>
      {brand.logo ? (
        <img src={brand.logo} alt={full} />
      ) : (
        <>
          <span className="brand-name">{rest.length ? `${name}.` : name}</span>
          {rest.length > 0 && <span className="brand-tagline">{rest.join('. ')}</span>}
        </>
      )}
    </Link>
  );
}

function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.end} className="nav-link" onClick={onClick}>
      <Icon size={22} aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}

function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Menú principal">
        <Brand />
        {NAV.map((item) => <NavItem key={item.to} item={item} />)}
      </nav>

      <header className="mobile-header">
        <Brand />
      </header>

      <main className="main">
        <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
      </main>

      <nav className="bottom-nav" aria-label="Menú">
        {NAV.filter((n) => BOTTOM.includes(n.to)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon size={24} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
        <button type="button" onClick={() => setMenuOpen(true)}>
          <Menu size={24} aria-hidden="true" />
          Más
        </button>
      </nav>

      {menuOpen && (
        <div className="menu-sheet" onClick={() => setMenuOpen(false)}>
          <div className="menu-sheet-inner" onClick={(e) => e.stopPropagation()}>
            {NAV.map((item) => <NavItem key={item.to} item={item} onClick={() => setMenuOpen(false)} />)}
            <button type="button" className="btn" onClick={() => setMenuOpen(false)}>
              <X size={22} aria-hidden="true" /> Cerrar menú
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <FeedbackProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vender" element={<SalePage key="normal" mode="normal" />} />
            <Route path="/feria" element={<SalePage key="feria" mode="feria" />} />
            <Route path="/ventas" element={<SalesPage />} />
            <Route path="/ventas/:id" element={<SaleDetailPage />} />
            <Route path="/ventas/:id/editar" element={<SalePage key="editar" mode="normal" />} />
            <Route path="/caja" element={<CashPage />} />
            <Route path="/gastos" element={<ExpensesPage />} />
            <Route path="/informes" element={<ReportsIndexPage />} />
            <Route path="/informes/:tipo" element={<ReportPage />} />
            <Route path="/compras" element={<PurchasesPage />} />
            <Route path="/compras/nueva" element={<PurchaseNewPage />} />
            <Route path="/compras/:id" element={<PurchaseDetailPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/productos/nuevo" element={<ProductEditPage />} />
            <Route path="/precios" element={<MassPricesPage />} />
            <Route path="/productos/:id" element={<ProductEditPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/categorias/nueva" element={<CategoryEditPage />} />
            <Route path="/categorias/:id" element={<CategoryEditPage />} />
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/proveedores/nuevo" element={<SupplierEditPage />} />
            <Route path="/proveedores/:id" element={<SupplierEditPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/respaldo" element={<BackupPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </FeedbackProvider>
    </HashRouter>
  );
}

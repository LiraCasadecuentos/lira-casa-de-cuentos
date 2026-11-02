// Muestra las dos medidas de ganancia, con nombres distintos para no confundirlas.

import { markupPct, marginPct, unitProfit } from '../logic/pricing.js';
import { formatMoney, formatPercent } from '../logic/money.js';

export default function ProfitInfo({ cost, price }) {
  const recargo = markupPct(cost, price);
  const margen = marginPct(cost, price);
  const ganancia = unitProfit(cost, price);

  if (!cost || !price) {
    return <p className="muted small">Cargá el costo y el precio de venta para ver cuánto se gana.</p>;
  }

  return (
    <>
      <p style={{ margin: '0.5rem 0 0' }}>
        Ganancia por unidad: <strong>{formatMoney(ganancia)}</strong>
        {ganancia < 0 && <span className="badge badge-sin" style={{ marginLeft: 8 }}>Se vende a pérdida</span>}
      </p>
      <div className="profit-box">
        <div className="profit-item profit-recargo">
          <div className="profit-name">Recargo sobre el costo</div>
          <div className="profit-value">{formatPercent(recargo)}</div>
          <div className="profit-help">Cuánto le sumamos a lo que nos costó. Con costo {formatMoney(cost)} le sumamos {formatMoney(ganancia)}.</div>
        </div>
        <div className="profit-item profit-margen">
          <div className="profit-name">Margen sobre la venta</div>
          <div className="profit-value">{formatPercent(margen)}</div>
          <div className="profit-help">Qué parte de lo que cobramos es ganancia. De cada {formatMoney(price)} que cobramos, {formatMoney(ganancia)} son ganancia.</div>
        </div>
      </div>
    </>
  );
}

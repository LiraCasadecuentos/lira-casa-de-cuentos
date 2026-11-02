// Si una pantalla falla, en lugar de quedar en blanco mostramos un mensaje amable.
// Los datos no se pierden: están guardados en el dispositivo.

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error en la pantalla:', error, info);
  }

  componentDidUpdate(prev) {
    // Al cambiar de pantalla, se vuelve a intentar.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" role="alert">
        <h1>Algo salió mal en esta pantalla</h1>
        <p>No te preocupes: los datos están guardados. Probá volver al inicio. Si vuelve a pasar, cerrá la app y abrila de nuevo.</p>
        <div className="row">
          <a href="#/" className="btn btn-principal" onClick={() => this.setState({ error: null })}>Volver al inicio</a>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Recargar la app</button>
        </div>
        <details style={{ marginTop: '1rem' }}>
          <summary className="small muted">Detalle técnico (para quien arregle la app)</summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.stack || this.state.error)}</pre>
        </details>
      </div>
    );
  }
}

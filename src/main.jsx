import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/400-italic.css';
import './theme/theme.css';
import './theme/app.css';
import App from './App.jsx';
import { ensureDefaults } from './db/repo.js';

function showStartupError(error) {
  console.error(error);
  document.getElementById('root').innerHTML = `
    <div style="max-width:520px;margin:3rem auto;padding:1.5rem;font-family:sans-serif;font-size:18px;line-height:1.5">
      <h1 style="font-size:1.5rem">No se pudo abrir la app</h1>
      <p>Puede pasar si el navegador está en modo privado / incógnito, o si no deja guardar datos.</p>
      <p>Probá abrirla en una ventana normal. Si sigue igual, cerrá el navegador y volvé a abrirlo.</p>
    </div>`;
}

ensureDefaults()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch(showStartupError);

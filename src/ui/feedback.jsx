// Mensajes cortos ("Guardado") y diálogos de confirmación ("¿Seguro que querés borrar?").
// Uso:
//   const toast = useToast();      toast('Producto guardado')   toast('No se pudo', 'error')
//   const confirm = useConfirm();  if (await confirm({ title, message, confirmText, danger: true })) { ... }

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';

const ToastContext = createContext(() => {});
const ConfirmContext = createContext(async () => false);

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = 'ok') => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 6000 : 3000);
  }, []);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    [],
  );

  const close = (answer) => {
    dialog?.resolve(answer);
    setDialog(null);
  };

  return (
    <ToastContext.Provider value={showToast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`} role="status">
            {toast.type === 'error' ? <CircleX size={22} aria-hidden="true" /> : <CircleCheck size={22} aria-hidden="true" />}
            {toast.message}
          </div>
        )}
        {dialog && (
          <div className="dialog-backdrop" onClick={() => close(false)}>
            <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2>{dialog.title}</h2>
              {typeof dialog.message === 'string' ? <p>{dialog.message}</p> : dialog.message}
              <div className="dialog-actions">
                <button type="button" className="btn" onClick={() => close(false)} autoFocus>
                  {dialog.cancelText || 'Cancelar'}
                </button>
                <button type="button" className={`btn ${dialog.danger ? 'btn-peligro-lleno' : 'btn-principal'}`} onClick={() => close(true)}>
                  {dialog.confirmText || 'Sí, seguir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
export const useConfirm = () => useContext(ConfirmContext);

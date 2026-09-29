import { useContext } from 'react';
import ToastContext from '../context/ToastContext';

/**
 * `{ toast, success, error, warning, info, dismiss }`.
 *
 * Lives in a plain `.js` file so it can be imported from anywhere without
 * pulling JSX through the transform; the provider and the markup live in
 * `context/ToastContext.jsx`.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default useToast;

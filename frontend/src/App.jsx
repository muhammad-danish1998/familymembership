import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext.jsx';
import { ToastProvider } from './components/common/ToastContext.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

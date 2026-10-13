import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoadingScreenProvider } from './components/loading';
import App from './App';
import './index.css';

/**
 * Mock API bootstrap.
 *
 * `import('./mocks')` is a dynamic import on purpose: when `VITE_USE_MOCKS` is
 * off, nothing ever loads it, so the fixtures, fake data and the amber banner
 * never appear in a live deployment — and no `src/services` file has to know
 * the difference between a mocked and a real transport.
 *
 * The app is not rendered until that import resolves. Installing the adapter in
 * an effect instead would be a race: `AuthProvider` fires `getCurrentUser()`
 * on mount, and with a token already in localStorage that request could leave
 * for the real backend before the adapter is in place.
 */
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';

const root = ReactDOM.createRoot(document.getElementById('root'));

/**
 * The parent portal's cache.
 *
 * `refetchOnWindowFocus: false` because a parent who switches tabs to their
 * banking app and back must not watch every fee figure reload under them —
 * a balance that moves on its own while they are reading it is worse than one
 * that is one payment stale. `retry: 1` rather than the default three: on the
 * 3G connections this portal is built for, a retried request is usually the
 * same dead connection, and three of them triples the wait before the error
 * screen the parent actually needs.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const renderApp = (mockPanel) => {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <LoadingScreenProvider
          variant="pulse"
          minDisplayTime={1000}
          logoSrc="/sukuupay-logo.png"
          logoAlt="SukuuPay"
          size={120}
          backgroundColor="#ffffff"
        >
          <App />
          {mockPanel}
        </LoadingScreenProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

if (useMocks) {
  // `preinstall` must run before `services/api.js` is evaluated — see the
  // comment in `mocks/preinstall.js` for why the ordering matters.
  import('./mocks/preinstall')
    .then(({ preinstallMockApi }) => preinstallMockApi())
    .then(() => import('./mocks'))
    .then(({ installMockApi, MockControlPanel }) => {
      installMockApi();
      renderApp(<MockControlPanel />);
    });
} else {
  renderApp(null);
}

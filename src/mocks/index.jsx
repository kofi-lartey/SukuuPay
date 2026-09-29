/**
 * Mock environment entry point.
 *
 * `main.jsx` imports this dynamically and only when `VITE_USE_MOCKS` is on, so
 * none of the fixtures, handlers or fake data reach a production bundle. That
 * separation is the reason the mocks can be as messy as they need to be.
 *
 * Installing a custom axios adapter rather than stubbing `fetch` is deliberate:
 * `src/services/*` and the interceptors in `services/api.js` are the code under
 * test, and they must run unmodified.
 */

import api from '../services/api';
import { preinstallMockApi } from './preinstall';
import { mockAdapter } from './adapter';
import MockControlPanel from './MockControlPanel';
import { getPersonaId, getScenarioId, resetDb, setScenario } from './db';

let installed = false;

export const installMockApi = () => {
  if (installed) return;
  installed = true;

  // Covers the bare-`axios` refresh call in `services/api.js`; the instance
  // below is set explicitly as well in case this runs before `preinstall`.
  preinstallMockApi();
  api.defaults.adapter = mockAdapter;

  // Restore the last persona and scenario so a reload does not drop a tester
  // back into a state they were not debugging. Not a security consideration —
  // this whole module is dev-only and never bundled for production.
  const storedPersona = localStorage.getItem('sukuupay_mock_persona');
  if (storedPersona) resetDb(storedPersona);
  const storedScenario = localStorage.getItem('sukuupay_mock_scenario');
  if (storedScenario) setScenario(storedScenario);

  api.defaults.adapter = mockAdapter;

  // A loud, unmissable banner. A demo environment that looks like production is
  // worse than none: screenshots and bug reports get mixed up.
  const banner = document.createElement('div');
  banner.setAttribute('data-testid', 'mock-banner');
  banner.textContent = 'MOCK API — no real backend, no real data, no real SMS';
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:9999',
    'background:#B45309',
    'color:#fff',
    'font:700 11px/1.4 ui-sans-serif,system-ui,sans-serif',
    'text-align:center',
    'padding:4px 8px',
    'letter-spacing:0.08em',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(banner);
};

export { MockControlPanel, getPersonaId, getScenarioId };
export default installMockApi;

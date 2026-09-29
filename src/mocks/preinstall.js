/**
 * Adapter pre-installation.
 *
 * This module is imported and called *before* anything imports
 * `services/api.js`, which is the whole reason it exists separately from
 * `index.jsx`.
 *
 * `api.js` builds its instance with `axios.create({...})`, and `axios.create`
 * copies the defaults at the moment it is called. Setting
 * `axios.defaults.adapter` afterwards therefore only reaches the returned
 * instance — not the bare `axios` object. And `api.js`'s refresh interceptor
 * uses the bare object:
 *
 *     const response = await axios.post(`${API_BASE_URL}/auth/refresh`, ...)
 *
 * so a mock installed on the instance alone would let every token refresh
 * escape to the real network. That is not a cosmetic gap: the refresh path is
 * the one that runs on every 401, so the mock would be unable to test any of
 * the session-expiry behaviour it exists to cover.
 *
 * Setting the global default before `api.js` is evaluated means the instance
 * inherits the mock adapter AND the bare-axios call uses it too.
 */

import axios from 'axios';
import { mockAdapter } from './adapter';

let preinstalled = false;

export const preinstallMockApi = () => {
  if (preinstalled) return;
  preinstalled = true;
  axios.defaults.adapter = mockAdapter;
};

export default preinstallMockApi;

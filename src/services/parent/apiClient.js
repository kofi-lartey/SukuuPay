import axios from 'axios';

/**
 * The parent portal's API client.
 *
 * Every request carries the token in the URL path — the parent is not
 * authenticated by a JWT, they are authenticated by possession of an
 * unguessable token that only ever appears in their pay-link. The token is
 * passed as the first argument to each service function and threaded into
 * the URL here, so no service has to remember to include it.
 *
 * **`VITE_API_BASE_URL` with the deployed backend as the fallback**, not a
 * relative `/api`: the portal ships as a static build with no env file, and a
 * relative base would send every parent call to the marketing origin. This is
 * the same variable and the same fallback `services/api.js` uses.
 *
 * Response shape from every parent endpoint:
 *   { success: true, message: string, data: T, meta?: {...} }
 *
 * On error, axios throws. The interceptor unwraps the server's error body
 * into a plain Error with `.code` and `.status` set, so callers can
 * `catch (err) { if (err.code === 'PARENT_EMAIL_REQUIRED') … }`.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api',
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const payload = error.response?.data;
    const err = new Error(
      payload?.message || error.message || 'Something went wrong'
    );
    err.status = error.response?.status;
    err.code = payload?.code;
    err.meta = payload?.meta;
    throw err;
  }
);

export default apiClient;

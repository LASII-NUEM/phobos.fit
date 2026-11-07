/**
 * Authentication and Access Control Configuration for PHOBOS Zfit
 * 
 * Infrastructure Context:
 * - Frontend Host: GitHub Pages (https://phobos.fit)
 * - Backend API Host: Render Web Service (https://phobos-zfit-api.onrender.com)
 * 
 * Toggle `ENABLE_LOGIN_GATE`:
 * - `true`  : Enforces the login page gate before accessing any workbench module.
 * - `false` : Disables authentication completely (direct access to all features).
 */

export const AUTH_CONFIG = {
  /**
   * Boolean value to switch between enabling or disabling the login step.
   * Change this to `false` when public open access is desired.
   */
  ENABLE_LOGIN_GATE: true,

  /**
   * Release version credentials
   */
  CREDENTIALS: {
    USERNAME: 'LASII',
    PASSWORD: 'bagre',
  },

  /**
   * Key used in browser storage (localStorage / sessionStorage)
   */
  SESSION_STORAGE_KEY: 'phobos_zfit_session_user',
} as const;

/**
 * PHOBOS Zfit - Production Infrastructure Configuration
 * 
 * Infrastructure Mapping:
 * - Frontend Host: GitHub Pages (https://phobos.fit)
 * - Frontend Repo: https://github.com/LASII-NUEM/phobos.fit.git
 * - Backend API Host: Render Web Service (https://phobos-zfit-api.onrender.com)
 * - Backend Python Repo: https://github.com/LASII-NUEM/PHOBOS_Zfit.git
 * 
 * Built-in Production Backend URL:
 * Embedded directly in the frontend client code so that users enjoy automatic,
 * zero-configuration connectivity to the Python Flask backend.
 */

export const RENDER_BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string) || 'https://phobos-zfit-api.onrender.com';

export const FRONTEND_URL = 'https://phobos.fit';
export const GITHUB_FRONTEND_REPO = 'https://github.com/LASII-NUEM/phobos.fit.git';
export const GITHUB_BACKEND_REPO = 'https://github.com/LASII-NUEM/PHOBOS_Zfit.git';

export const API_ENDPOINTS = {
  HEALTH: `${RENDER_BACKEND_URL}/`,
  FIT: `${RENDER_BACKEND_URL}/api/fit`,
  SIMULATE: `${RENDER_BACKEND_URL}/api/simulate`,
  LINKK: `${RENDER_BACKEND_URL}/api/linkk`,
  READ_FILE: `${RENDER_BACKEND_URL}/api/read_file`,
} as const;


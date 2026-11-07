# PHOBOS Zfit

**Advanced Electrochemical Impedance Spectroscopy (EIS) Analysis & Equivalent Circuit Modeling Suite**

Developed by **LASII - NUEM - UTFPR**  
*Laboratory of Applied Solar Energy and Industrial Instrumentation*  
*Federal University of Technology - Paraná (Universidade Tecnológica Federal do Paraná)*

🌐 **Live Web Application:** [https://phobos.fit](https://phobos.fit)  
🚀 **Python API Host:** [https://phobos-zfit-api.onrender.com](https://phobos-zfit-api.onrender.com)  
📦 **Frontend Repository:** [https://github.com/LASII-NUEM/phobos.fit](https://github.com/LASII-NUEM/phobos.fit)  
🐍 **Backend Repository:** [https://github.com/LASII-NUEM/PHOBOS_Zfit](https://github.com/LASII-NUEM/PHOBOS_Zfit)

---

## 📌 Overview

**PHOBOS Zfit** is a modern, high-precision scientific web platform designed for researchers, electrochemists, corrosion engineers, and materials scientists. It bridges interactive, real-time client-side visualization with high-performance Python numerical algorithms to provide complete end-to-end impedance spectroscopy workflows.

### Key Capabilities:
- **⚡ Z Simulation Workbench:** Interactive Equivalent Circuit Model (ECM) builder with an Abstract Syntax Tree (AST) expression parser, supporting arbitrary circuit topologies (`+`, `//`, `((C+R)//R)`), presets (Randles, CPE, Warburg, Debye, Cole-Cole), and instant Nyquist/Bode synthesis.
- **📊 2D & 3D Data Visualization:** High-throughput ingestion of multi-spectrum `.csv` and `.xlsx` files. Interactive 2D Nyquist ($Z'$ vs. $-Z''$), 2D Bode ($|Z|$ and $\theta$ vs. $\log f$), 3D spatial trajectories ($Z', -Z'', \log f$), and dielectric permittivity/conductivity transformations ($\varepsilon', \varepsilon'', \tan\delta, \sigma'$).
- **🔬 Lin-KK Data Validation:** Linear Kramers-Kronig test using an automated Voigt RC circuit continuum to validate experimental data consistency, quantify measurement noise, and detect non-stationarity or DC drift.
- **🎯 Multi-Algorithm Circuit Fitting:** Non-linear complex least squares (CNLS) parameter optimization combining Levenberg-Marquardt, Nelder-Mead, and Powell algorithms powered by the Python `ECM_utils` core.
- **📈 Sensitivity & Bias Workbench:** Parametric gradient evaluation and DC bias drift analysis for transient electrochemical systems.
- **🌊 DRT Analysis:** Distribution of Relaxation Times deconvolution to resolve overlapping polarization processes without prior equivalent circuit assumptions.

---

## 🏗️ System Architecture

PHOBOS Zfit employs a **decoupled, hybrid cloud architecture** designed for high responsiveness, zero client configuration, and mathematical rigor:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT WEB BROWSER                                 │
│                                                                                 │
│   • Local Data Parsing (.csv / .xlsx)        • WebGL & 2D/3D Canvas Rendering   │
│   • Circuit Syntax AST Evaluation            • Client-side Session Security     │
│   • Fast Local Lin-KK Diagnostics            • Interactive Parameter Tuning     │
└───────────────────────▲─────────────────────────────────▲───────────────────────┘
                        │                                 │
      Static Assets     │                                 │ REST API Calls
      (HTML, JS, CSS)   │                                 │ (Fitting & Heavy Compute)
                        │                                 │
┌───────────────────────┴───────────────┐ ┌───────────────┴───────────────────────┐
│         GITHUB PAGES HOST             │ │          RENDER WEB SERVICE           │
│         https://phobos.fit            │ │  https://phobos-zfit-api.onrender.com │
│                                       │ │                                       │
│  • Edge-CDN distributed static SPA    │ │  • Python Flask API (Python 3.11+)    │
│  • GitHub Actions CI/CD deployment    │ │  • SciPy, NumPy, ECM_utils Engine     │
│  • Custom domain & SSL management     │ │  • CNLS Optimization (Levenberg-M.)  │
│  • Zero server maintenance overhead   │ │  • Automated CORS & Health Endpoints  │
└───────────────────────────────────────┘ └───────────────────────────────────────┘
```

### 1. Frontend: Static SPA on GitHub Pages (`phobos.fit`)
- **Technology:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **Role:** Delivers an ultra-fast, responsive user interface. All file parsing, table manipulation, 2D/3D plotting, and circuit syntax checks execute 100% locally in the user's browser for maximum speed and privacy.
- **CI/CD:** Automated deployment via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`.

### 2. Backend: High-Precision Python API on Render
- **Technology:** Python, Flask, SciPy, NumPy, `ECM_utils.CircuitParams`.
- **Role:** Handles compute-heavy non-linear complex least squares (CNLS) circuit fitting, matrix inversions, and advanced Kramers-Kronig residual calculations.
- **Connectivity:** The frontend contains zero-configuration auto-detection to communicate seamlessly with the Render API at `https://phobos-zfit-api.onrender.com`.

---

## 🔐 Access Control & Release Gate

For staged laboratory deployments, PHOBOS Zfit includes a configurable release authentication gate located in `src/config/authConfig.ts`:

```typescript
export const AUTH_CONFIG = {
  /**
   * Set this boolean value to switch between enabling or disabling the login step:
   * - true  : Enforces the login page gate before accessing workbenches.
   * - false : Direct open access for public releases.
   */
  ENABLE_LOGIN_GATE: true,

  CREDENTIALS: {
    USERNAME: 'LASII',
    PASSWORD: 'bagre',
  },

  SESSION_STORAGE_KEY: 'phobos_zfit_session_user',
} as const;
```

- When `ENABLE_LOGIN_GATE: true`: Visitors are greeted by the minimal **Phobos Login** portal.
- When authenticated: The user session is preserved in browser storage, and a **Logout** button is available in the top navigation bar.

---

## 📋 Supported Data Formats

PHOBOS Zfit natively supports the two primary data formats used in laboratory impedance spectroscopy:

### 1. Chemistry EIS Data (`.csv` and `.xlsx`)

#### A. Multi-Parameter CSV (`.csv`)
Standard potentiostat / Autolab export structure:
```csv
freq / Hz,Log(f / Hz),neg. Phase / °,Idc / uA,Z / Ohm,Z' / Ohm,-Z'' / Ohm,Y' / S,Y'' / S,Log(Y / S),Cs / F,
100000,5.0000,12.45,0.0125,124.8,121.9,26.9,0.0078,0.0017,-2.099,5.92e-8,
50000,4.6989,18.32,0.0118,152.3,144.6,47.8,0.0062,0.0021,-2.183,6.66e-8,
10000,4.0000,35.18,0.0094,248.5,203.1,143.2,0.0033,0.0023,-2.395,1.11e-7,
1000,3.0000,52.84,0.0041,894.2,539.8,712.3,0.00067,0.00089,-2.951,2.23e-7,
100,2.0000,58.91,0.0012,4120.5,2127.3,3528.1,0.00012,0.00021,-3.615,4.51e-7,
10,1.0000,47.20,0.0003,12450.0,8450.2,9140.7,0.000054,0.000059,-4.095,1.74e-6,
```

#### B. Spreadsheet Columns (`.xlsx`)
Four primary spectral columns:
| freq / Hz | neg. Phase / ° | Z' / Ohm | Z'' / Ohm |
| :--- | :--- | :--- | :--- |
| `100000` | `12.45` | `121.9` | `-26.9` |
| `10000`  | `35.18` | `203.1` | `-143.2` |
| `1000`   | `52.84` | `539.8` | `-712.3` |
| `100`    | `58.91` | `2127.3`| `-3528.1` |
| `10`     | `47.20` | `8450.2`| `-9140.7` |

---

### 2. Phobos Swept Multielectrode Data (`.csv`)
Dedicated hardware format measuring equivalent parallel capacitance ($C_p$) and resistance ($R_p$) across swept frequencies:

```csv
unix timestamp / mode / freq1 Cp / freq1 Rp / ..../ freq n Cp / freq n Rp
```

**Example:**
```csv
timestamp,mode,100000 Cp,100000 Rp,50000 Cp,50000 Rp,10000 Cp,10000 Rp,1000 Cp,1000 Rp,100 Cp,100 Rp,10 Cp,10 Rp
1709283600,swept,8.24e-10,42000,8.38e-10,43100,8.55e-10,45200,8.80e-10,48100,9.10e-10,50200,9.45e-10,51800
1709283660,swept,8.23e-10,42050,8.37e-10,43120,8.54e-10,45230,8.79e-10,48150,9.09e-10,50220,9.44e-10,51850
```

#### Automated Physics Transformation:
For each channel, admittance $Y$ is reconstructed and mapped into complex impedance:
$$Y = \frac{1}{R_p} + j\omega C_p \implies Z' = \frac{R_p}{1 + (\omega R_p C_p)^2}, \quad Z'' = -\frac{\omega R_p^2 C_p}{1 + (\omega R_p C_p)^2}$$

When reference air capacitance $C_0$ is provided, the platform automatically derives:
- **Relative Permittivity:** $\varepsilon' = \frac{C_p}{C_0}$
- **Dielectric Loss:** $\tan(\delta) = \frac{1}{\omega R_p C_p}$
- **AC Conductivity:** $\sigma' = \omega \varepsilon_0 \varepsilon''$

---

## 🔣 Equivalent Circuit Syntax (`ECM_utils`)

Circuit models are described using intuitive string syntax evaluated by both the TypeScript local previewer and Python fitting backend:

| Operator / Symbol | Definition | Example |
| :--- | :--- | :--- |
| `+` | Series connection | `Rs + Rct` |
| `//` | Parallel connection | `(Rct // Cdl)` |
| `((C+R) // R)` | Nested parallel branch template | `Rs + ((C1 + R1) // R2)` |
| `CPE` | Constant Phase Element ($Z = \frac{1}{Q (j\omega)^\alpha}$) | `(Rct // CPE1)` |
| `W` | Semi-infinite Warburg diffusion element | `Rs + (Rct // Cdl) + W1` |
| `L` | Inductance element | `L1 + Rs + (Rct // Cdl)` |

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js** (v20 or higher recommended)
- **npm** (v10 or higher)

### Installation
```bash
# Clone the repository
git clone https://github.com/LASII-NUEM/phobos.fit.git
cd phobos.fit

# Install dependencies
npm install

# Start development server
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### Production Build
```bash
# Compile and package for GitHub Pages
npm run build
```
This generates the optimized production bundle in `dist/` and duplicates `index.html` to `404.html` for single-page application routing on GitHub Pages.

---

## 🚀 Deployment Workflow to GitHub Pages

Deployment is automated via **GitHub Actions**:

1. Push your changes to the `main` branch:
   ```bash
   git add -A
   git commit -m "Update application"
   git push origin main
   ```
2. GitHub Actions detects the `.github/workflows/deploy.yml` workflow, compiles the Vite project, and publishes the artifacts to **GitHub Pages**.
3. In your repository settings under **Settings** $\rightarrow$ **Pages**:
   - **Source:** Select `GitHub Actions`.
   - **Custom Domain:** Configured as `phobos.fit` (backed by `public/CNAME`).
   - **Enforce HTTPS:** Enabled.

---

## 🏛️ Laboratory & Institutional Credits

**PHOBOS Zfit** is actively researched and developed by:
- **LASII** — *Laboratório de Energia Solar e Instrumentação Industrial*
- **NUEM** — *Núcleo de Escoamento Multifásico*
- **UTFPR** — *Universidade Tecnológica Federal do Paraná, Curitiba - PR, Brazil*

---

## 📄 License
This project is licensed under the academic and research terms of LASII - NUEM - UTFPR. All rights reserved.

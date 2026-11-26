# LS Interiors — Window Measurement & Project Management System

A full-stack web application for **uPVC Window & Door Measurement, Fabrication Formulas, 2D CAD Blueprints, PDF Exports, Customer Management, and Secure Authentication**.

Built with **React + TypeScript + Vite** (Frontend) and **FastAPI + SQLAlchemy** (Backend).

---

## Table of Contents

1. [What Changed in the Website](#1-what-changed-in-the-website)
2. [How to Run the Project on Localhost](#2-how-to-run-the-project-on-localhost)
3. [How to Deploy to Vercel](#3-how-to-deploy-to-vercel)
4. [How to Buy a Domain in Hostinger & Connect to Vercel](#4-how-to-buy-a-domain-in-hostinger--connect-to-vercel)
5. [How to Add & Submit to Google Search Console](#5-how-to-add--submit-to-google-search-console)

---

## 1. What Changed in the Website

### Authentication, 2-Step Email OTP & Profile
* **Unified Sign In + 2-Step Email OTP:** Users sign in with **Email + Password**, then verify a **6-digit OTP** sent via Gmail SMTP (or printed in the backend terminal during local dev if SMTP is not set).
* **Register & Password Reset:** New staff/owner accounts can register, and users can reset forgotten passwords using a single-use OTP + reset token.
* **Connected User Profile:** Logged-in user details (`Full Name`, `Email`, `Phone`, `Role`) are loaded from `/auth/me` and shown in the **Sidebar** (with **Logout**) and **Settings** (with **Sign Out**).
* **Protected API & Shop Isolation:** All customer, project, measurement, and dashboard routes require a valid JWT `Bearer` token and are scoped to the user's shop.

### Admin Portal
* Accessible from the Sign In screen via **🔒 Admin Portal** (protected by `ADMIN_PASSCODE`, default `735195`).
* Admins can view all registered users, **Block / Unblock** accounts, or **Delete** users.

### Automatic `.env` Email Updates
* `backend/.env` is reloaded automatically on every OTP request, so changing `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, or `OTP_RECEIVER_EMAIL` takes effect immediately with **no code changes** and **no restart**.

### Customers, Dashboard & Production Fixes
* **Customers Page:** Added an **Update Order / Measurement** button next to **Edit** and **Delete** in each customer row to jump straight to **Measurements & Orders**.
* **Dashboard & Backend Fixes:**
  * `GET /dashboard/stats` and `GET /projects/` are now strictly read-only (no unintended status overwrites).
  * Soft-deleted customers are excluded from Dashboard analytics.
  * Added `VITE_API_BASE_URL` support in `src/utils/api.ts` (defaults to `/api` on localhost).
  * Added `psycopg[binary]` to `backend/requirements.txt` for PostgreSQL readiness.

---

## 2. How to Run the Project on Localhost

### Prerequisites
Make sure these are installed on your computer:
* **Python 3.10+** (`python --version`)
* **Node.js 18+ & npm** (`node -v` and `npm -v`)

### Step 1: Configure `backend/.env`
Create or edit `backend/.env`:
```env
SECRET_KEY=your-long-random-secret-key
ADMIN_PASSCODE=735195
GMAIL_ADDRESS=your_email@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
OTP_RECEIVER_EMAIL=
```
> **Note:** Leave `OTP_RECEIVER_EMAIL=` blank to send OTPs to each user's own email, or set an email address to route all OTPs to one inbox.

### Step 2: Start the Backend (Terminal 1)
```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
* Backend API runs at: `http://127.0.0.1:8000`
* API Docs (Swagger): `http://127.0.0.1:8000/docs`

### Step 3: Start the Frontend (Terminal 2)
```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
* Open your browser to: **`http://127.0.0.1:5173`**
* All `/api/*` requests automatically proxy to `http://127.0.0.1:8000`.

### Step 4: Build Check (Optional)
```powershell
cd frontend
npm run build
```

---

## 3. How to Deploy to Vercel

Because this project has a **React Frontend** and a **FastAPI Backend**, deploy the backend first (so you have its URL), then deploy the frontend on Vercel.

### Step 1: Deploy Backend API
Deploy `backend/` to a Python host (e.g. **Render**, **Railway**, or **Vercel Python**) with:
* **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
* **Environment Variables:**
  * `DATABASE_URL` (PostgreSQL connection string, e.g., Neon or Supabase)
  * `SECRET_KEY`
  * `ADMIN_PASSCODE`
  * `GMAIL_ADDRESS`
  * `GMAIL_APP_PASSWORD`
  * `OTP_RECEIVER_EMAIL` *(optional)*
  * `CORS_ORIGINS` = `https://your-vercel-app.vercel.app,https://yourdomain.com`

### Step 2: Deploy Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New $\rightarrow$ Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Confirm build settings:
   * **Framework Preset:** `Vite`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
5. Add **Environment Variable**:
   * `VITE_API_BASE_URL` = `https://your-backend-api-url.com` *(no trailing slash)*
6. Click **Deploy**.

---

## 4. How to Buy a Domain in Hostinger & Connect to Vercel

### Step 1: Buy Your Domain on Hostinger
1. Go to [hostinger.com](https://www.hostinger.com) and log in (or create an account).
2. Click **Domains $\rightarrow$ Get a New Domain**.
3. Search for your business name (e.g. `lsinteriors.com` or `lsinteriors.in`), choose the `.com` / `.in` extension, and complete checkout.
4. Verify your domain ownership via the confirmation email Hostinger sends you.

### Step 2: Add the Domain in Vercel
1. Open your project in **Vercel Dashboard**.
2. Go to **Settings $\rightarrow$ Domains**.
3. Type your domain (e.g. `yourdomain.com`) and click **Add**.
4. Vercel will show you the exact DNS records to add (`A` record and `CNAME` record).

### Step 3: Update DNS Records in Hostinger
1. In **Hostinger hPanel**, go to **Domains $\rightarrow$ Manage** (select your domain) $\rightarrow$ **DNS / Nameservers**.
2. Under **DNS Records**, add/update:
   * **Root domain (`@`):**
     * Type: `A`
     * Name: `@`
     * Points to: `76.76.21.21`
   * **WWW subdomain (`www`):**
     * Type: `CNAME`
     * Name: `www`
     * Target: `cname.vercel-dns.com`
3. Save changes. DNS usually connects within **5–30 minutes** (up to 24 hours max), and Vercel automatically issues a free SSL (`https://`) certificate.
4. *(Important)* Add `https://yourdomain.com,https://www.yourdomain.com` to `CORS_ORIGINS` on your backend!

---

## 5. How to Add & Submit to Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console) and sign in with your Google account.
2. Click **Add Property** $\rightarrow$ choose **Domain** (e.g., `yourdomain.com`) and click **Continue**.
3. Google will give you a **TXT verification record** (e.g. `google-site-verification=...`).
4. Open **Hostinger hPanel $\rightarrow$ Domains $\rightarrow$ DNS / Nameservers** and add a new DNS record:
   * Type: `TXT`
   * Name: `@`
   * TXT Value: *(paste the `google-site-verification=...` string)*
5. Wait 5–10 minutes, then return to Google Search Console and click **Verify**.
6. Once verified:
   * Use **URL Inspection** at the top $\rightarrow$ enter `https://yourdomain.com/` $\rightarrow$ click **Request Indexing**.
   * If you add a `sitemap.xml` in `frontend/public/sitemap.xml`, go to **Sitemaps** in the left menu, enter `sitemap.xml`, and click **Submit**.

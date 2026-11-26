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
* Accessible from the Sign In screen via **🔒 Admin Portal** (protected by `ADMIN_PASSCODE` configured in `backend/.env`).
* Admins can view all registered users, **Block / Unblock** accounts, or **Delete** users.

### Automatic `.env` Email Updates
* `backend/.env` is reloaded automatically on every OTP request, so changing `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, or `OTP_RECEIVER_EMAIL` takes effect immediately with **no code changes** and **no restart**.

### Customers, Per-User Isolation & Production Fixes
* **Per-User Isolated Data:** Each registered user gets their own dedicated shop (`shop_id`), so customers, projects (`PROJ-1`, `PROJ-2`, ...), measurements, and dashboard analytics are completely private per user.
* **Customers & Measurements Flow:**
  * Editable **Customer Serial Number** in Add/Edit Customer modals, displayed directly in the Customers table and details panel.
  * Adding a customer automatically redirects to **Measurements & Orders**.
  * Added **Update Order / Measurement** button in each customer row, which opens **Measurements & Orders** and automatically loads that customer's saved project and windows.
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
Copy `backend/.env.example` to `backend/.env` and fill in your values (use encrypted `GMAIL_ADDRESS_ENC` and `GMAIL_APP_PASSWORD_ENC` so plain-text credentials are never stored):
```env
SECRET_KEY=your-long-random-secret-key
ADMIN_PASSCODE=your-admin-passcode
GMAIL_ADDRESS_ENC=enc1:...
GMAIL_APP_PASSWORD_ENC=enc1:...
OTP_RECEIVER_EMAIL=
```
> **Note:** Leave `OTP_RECEIVER_EMAIL=` blank to send OTPs to each user's own email, or set an email address to route all OTPs to one inbox.

#### How to Encrypt a New Gmail / App Password in the Future
If you ever change your Gmail address or generate a new 16-letter Google App Password:
1. Run this command inside `backend/`:
   ```powershell
   python -c "from app.core.security import encrypt_secret; print('GMAIL_ADDRESS_ENC=' + encrypt_secret('new@gmail.com')); print('GMAIL_APP_PASSWORD_ENC=' + encrypt_secret('new 16 letter pass'))"
   ```
2. Copy the two printed `enc1:...` lines into `backend/.env` (replacing the old `GMAIL_ADDRESS_ENC` and `GMAIL_APP_PASSWORD_ENC` values).
3. No code changes or server restart are needed—`email_service.py` automatically reloads `backend/.env` and decrypts them in memory on the next OTP request.
4. *(Security tip)* If you suspect your old App Password was exposed, revoke it in **Google Account $\rightarrow$ Security $\rightarrow$ App Passwords**.

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

## 3. How to Deploy Your Website Online (Vercel)

Think of your website in **2 parts**:
1. **Backend (Python FastAPI)** — handles login, OTP emails, customers, and database.
2. **Frontend (React Website)** — the visual pages you click on.

> **Important:** Deploy the **Backend first** so you get a live Backend URL, then put that URL into **Vercel** for the Frontend.

### Part A: Put Your Backend Online (Render — Free & Easy)
1. Go to [render.com](https://render.com) and sign in with your **GitHub account**.
2. Click **New +** $\rightarrow$ **Web Service** $\rightarrow$ select your `upvc-software` repo.
3. Fill in these settings:
   * **Root Directory:** `backend`
   * **Runtime:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Scroll to **Environment Variables** and add these keys (from your `backend/.env`):
   * `SECRET_KEY` = *(your secret key)*
   * `ADMIN_PASSCODE` = *(your admin passcode)*
   * `GMAIL_ADDRESS_ENC` = *(your encrypted `enc1:...` value)*
   * `GMAIL_APP_PASSWORD_ENC` = *(your encrypted `enc1:...` value)*
   * `CORS_ORIGINS` = `https://your-site.vercel.app` *(update this after Part B)*
5. Click **Create Web Service**. Once it says **Live**, copy your Backend URL (for example: `https://upvc-backend.onrender.com`).

### Part B: Put Your Frontend Online (Vercel — Free & Easy)
1. Go to [vercel.com](https://vercel.com) and sign in with **GitHub**.
2. Click **Add New...** $\rightarrow$ **Project** $\rightarrow$ **Import** your `upvc-software` repo.
3. Under **Root Directory**, click **Edit** and select **`frontend`**.
4. Open **Environment Variables** and add:
   * **Name:** `VITE_API_BASE_URL`
   * **Value:** `https://upvc-backend.onrender.com` *(your Backend URL from Part A, no `/` at the end)*
5. Click **Deploy** and wait 1 minute.
6. Copy your new live Vercel URL (e.g. `https://upvc-software.vercel.app`) and paste it into `CORS_ORIGINS` on Render (Part A Step 4) so login works!

---

## 4. How to Buy a Domain in Hostinger & Connect It

Want your own custom website name like `lsinteriors.in` instead of `.vercel.app`? Follow these 3 steps:

### Step 1: Buy the Domain on Hostinger
1. Open [hostinger.com](https://www.hostinger.com) and sign in.
2. Click **Domains** $\rightarrow$ **Get a New Domain**.
3. Type your shop/business name (for example `lsinteriors.in` or `lsinteriors.com`) and click **Search**.
4. Pick an available name, complete payment, and click the verification link Hostinger sends to your email.

### Step 2: Tell Vercel About Your New Domain
1. Open your project on [vercel.com](https://vercel.com).
2. Click **Settings** (top tab) $\rightarrow$ **Domains** (left menu).
3. Type your domain (e.g. `lsinteriors.in`) and click **Add**.
4. Vercel will show you two values to copy (`76.76.21.21` and `cname.vercel-dns.com`).

### Step 3: Connect Hostinger to Vercel (DNS)
1. Go back to **Hostinger** $\rightarrow$ **Domains** $\rightarrow$ click **Manage** next to your domain $\rightarrow$ **DNS / Nameservers**.
2. Delete any old `A` or `CNAME` records for `@` or `www`, then add these **2 records**:
   * **Record 1 (Main site):**
     * **Type:** `A` | **Name:** `@` | **Points to:** `76.76.21.21`
   * **Record 2 (`www` site):**
     * **Type:** `CNAME` | **Name:** `www` | **Target:** `cname.vercel-dns.com`
3. Click **Save**. Wait **10–30 minutes**—your site will open at `https://yourdomain.com` with a free padlock (`HTTPS`).
4. Add `https://yourdomain.com,https://www.yourdomain.com` to `CORS_ORIGINS` on your Backend so login works on your new domain!

---

## 5. How to Put Your Site on Google (Google Search Console)

This tells Google your website exists so people can find it on Google Search:

1. Open [Google Search Console](https://search.google.com/search-console) and sign in with your Google account.
2. Click **Add Property** $\rightarrow$ click **Domain** $\rightarrow$ type `yourdomain.com` $\rightarrow$ click **Continue**.
3. Google shows a **TXT code** (looks like `google-site-verification=xxxxx`). Click **Copy**.
4. Open **Hostinger $\rightarrow$ Domains $\rightarrow$ Manage $\rightarrow$ DNS / Nameservers** and add 1 record:
   * **Type:** `TXT` | **Name:** `@` | **TXT Value:** *(paste the Google code)*
5. Wait 5 minutes, go back to Google Search Console, and click **Verify**.
6. After it says **Ownership verified**:
   * Click **URL Inspection** at the top, type `https://yourdomain.com/`, press Enter, and click **Request Indexing**.
   * Google will now crawl and list your website!

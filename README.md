# The Gaav ERP — Enterprise Unit-Economics & Artisanal Soap Suite

An enterprise-grade ERP system built for **The Gaav** artisanal soap business, providing real-time unit economics per sale, multi-channel sales aggregation, Shopify synchronization, inventory management, and overhead contribution tracking.

---

## 🚀 Key Features

* **Real-time Unit-Economics (Formulas 1–15)**:
  * **Formula 1 & 8**: Landed Unit Cost ($Landed = Mfg + Packaging + Other + \sum Shared$) and COGS snapshotting.
  * **Formula 7 & 9**: Automated channel commission, gateway take-rate, and courier expense deduction.
  * **Formula 10–13**: Live order contribution margins, channel-level and product-level profit rollups, and monthly trends.
  * **Formula 14 & 15**: Period overhead deduction (rent, utilities, salaries) and dynamic break-even volume calculator.
* **Multi-Channel Management**:
  * Shopify, WhatsApp Direct, Instagram D2C, Offline Retail, and Distributor channels with custom commission structures and delivery costs.
* **Shopify Two-Way Sync**:
  * Real-time order importing with line item discounts and inventory tracking.
  * Push manual orders directly to Shopify Admin and decrement centralized stock obeying inventory policy.
* **Inventory & Low Stock Alerts**:
  * Variant-level reorder thresholds, audit log history, and inventory movements ledger.
* **Financial Dashboards & Visualizations**:
  * Executive dashboard with contribution trends, channel performance donut charts, and top-profit product rankings.

---

## 🛠 Tech Stack

* **Frontend**: React (Vite), Tailwind CSS, Recharts, Lucide Icons, Axios.
* **Backend**: Node.js, Express, MySQL (mysql2 with connection pool).
* **Architecture**: Feature-sliced architecture with dedicated controllers, models, and route definitions.

---

## 📦 Getting Started

### 1. Database Setup
1. Create a MySQL database named `thegaaverp`.
2. Configure database credentials in `backend/.env` (see `backend/.env.example`).
3. Run migrations and seed data:
```bash
cd backend
node database/migrations/run_migrations.js
node database/seeds/seed.js
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Client runs on http://localhost:5173
```

---

## 📄 License
Private & Proprietary — The Gaav. All rights reserved.

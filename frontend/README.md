# The Gaav ERP - Frontend Application

Modern Centralized Sales, Inventory & Profitability Management System for The Gaav Organics.

## Tech Stack
- **Framework**: React 18 + Vite 5
- **Routing**: React Router v6
- **Styling**: Tailwind CSS + Custom Design System
- **Icons**: Lucide React
- **Data Visualization**: Recharts (Area, Bar, Pie charts)
- **HTTP Client**: Axios with JWT refresh token interceptors and auto-retry queue

## Project Structure
```
erp/frontend/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── api/
    │   └── axios.js                # Axios client with JWT refresh queue
    ├── components/
    │   ├── Layout/
    │   │   ├── AppLayout.jsx       # Global responsive shell
    │   │   ├── Header.jsx          # Top navbar with user profile & search
    │   │   └── Sidebar.jsx         # Collapsible navigation with badge counters
    │   ├── UI/
    │   │   ├── Badge.jsx           # Status badge system (colors & states)
    │   │   ├── Button.jsx          # Button component with loading spinner
    │   │   ├── EmptyState.jsx      # Empty state placeholder
    │   │   ├── LoadingSpinner.jsx  # SVG spin indicators
    │   │   ├── Modal.jsx           # Animated accessible dialog with backdrop
    │   │   ├── Pagination.jsx      # Pagination controls
    │   │   ├── StatCard.jsx        # KPI card with trends & color accents
    │   │   ├── Table.jsx           # Dynamic responsive data table
    │   │   └── Toast.jsx           # Notification toast provider
    │   ├── NotificationBell.jsx    # Real-time polling notification bell
    │   └── ProtectedRoute.jsx      # Role-based route authorization guard
    ├── context/
    │   └── AuthContext.jsx         # Global user session & permissions
    ├── hooks/
    │   ├── useAuth.js              # Authentication hook
    │   └── useFetch.js             # Data fetching hook with pagination
    ├── pages/
    │   ├── Login.jsx               # Authentication screen
    │   ├── Dashboard.jsx           # Executive overview & multi-chart analytics
    │   ├── Products.jsx            # Master product catalog & variants
    │   ├── ProductDetail.jsx       # SKU cost architectures & audit history
    │   ├── SalesChannels.jsx       # Multi-channel commission configurations
    │   ├── Orders.jsx              # Orders ledger with multi-filters
    │   ├── CreateOrder.jsx         # Real-time contribution margin order builder
    │   ├── OrderDetail.jsx         # Order deep-dive, formulas & refund workflow
    │   ├── Inventory.jsx           # Warehouse stock levels & adjustments
    │   ├── InventoryMovements.jsx  # Immutable stock movement ledger
    │   ├── ContributionAnalysis.jsx# Channel & product profitability analytics
    │   ├── ShopifyIntegration.jsx  # Phase 2 Shopify connector roadmap & config
    │   ├── SyncActivity.jsx        # Background synchronization queue & retries
    │   ├── Settings.jsx            # Currency, timezone & user role management
    │   └── AuditLogs.jsx           # Security state mutation diff inspector
    ├── utils/
    │   └── formatters.js           # Currency (₹ INR), date, and percent utils
    ├── App.jsx                     # Application routing definitions
    ├── index.css                   # Global styles & scrollbar utilities
    └── main.jsx                    # Root React DOM bootstrap
```

## Running the Application
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

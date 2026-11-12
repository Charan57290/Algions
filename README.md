# Pharmacy Management System

**Algions AI Labs | Full-Stack Internship Assessment**  
**Author:** Thota Kalicharan ([@Charan57290](https://github.com/Charan57290))  
**Repository:** [https://github.com/Charan57290/Algions](https://github.com/Charan57290/Algions)

---

## 1. Project Overview

The **Pharmacy Management System** is a complete, production-grade web application engineered for retail and hospital pharmacies. Built to satisfy real-world pharmacy operations, the application features batch-level inventory tracking, automated **FEFO (First-Expiry-First-Out)** stock allocation, Point of Sale (POS) billing with instant invoice generation, supplier purchase management, returns processing, and comprehensive stock movement audit trails.

> **Disclaimer:** All medicine, supplier, and tax data utilized in this system is strictly fictional for assessment and demonstration purposes. No real-world medical advice is provided.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **HTTP Client:** Axios
- **State & Forms:** React Context, React Hook Form, Zod validation
- **Data Visualization:** Recharts
- **Icons:** Lucide React

### Backend
- **Runtime & Framework:** Node.js, Express.js
- **Language:** TypeScript
- **Database ODM:** Mongoose
- **Database:** MongoDB (Local instance or MongoDB Atlas)
- **Authentication:** JWT (JSON Web Tokens) & bcryptjs
- **Security:** Helmet, CORS, Express Rate Limit
- **Logging:** Morgan

### Testing & Tooling
- **Unit & Integration Testing:** Vitest, Supertest
- **Code Quality:** ESLint, Prettier, TypeScript Strict Mode
- **Version Control:** Git & GitHub

---

## 3. Architecture & Repository Structure

```
Algions/
├── backend/
│   ├── src/
│   │   ├── config/          # Database and environment configurations
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Auth, RBAC, and error-handling middleware
│   │   ├── models/          # Mongoose database schemas
│   │   ├── routes/          # RESTful API route definitions
│   │   ├── services/        # Core business logic (FEFO, Inventory, Reports)
│   │   ├── validators/      # Zod validation schemas
│   │   ├── utils/           # Utility helpers and loggers
│   │   ├── app.ts           # Express application setup
│   │   └── server.ts        # Server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── assets/          # Static assets and icons
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Auth, Cart, and Notification contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── layouts/         # Role-based application layouts
│   │   ├── pages/           # Application views (POS, Dashboard, Inventory)
│   │   ├── services/        # Frontend API client modules
│   │   ├── utils/           # Formatters and helpers
│   │   ├── App.tsx          # Root application component
│   │   ├── main.tsx         # Application entry point
│   │   └── index.css        # Tailwind and global styles
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/
│   ├── architecture/        # Architecture diagrams and design decisions
│   ├── api/                 # API documentation and schemas
│   ├── reports/             # Technical reports and assessment documentation
│   └── screenshots/         # Application interface screenshots
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Key Modules & Planned Capabilities

1. **Role-Based Access Control (RBAC):** Admin and Pharmacist/Staff access tiers with server-side authorization guards.
2. **Medicine Master Data:** Complete pharmaceutical catalog with dosage, strength, category, manufacturer, and reorder thresholds.
3. **Supplier & Purchase Management:** Track suppliers, incoming inventory shipments, and unit purchase costs.
4. **Batch Inventory & FEFO Engine:** Discrete batch tracking with manufacturing and expiration dates. Outbound sales automatically consume the earliest-expiring batch first.
5. **POS & Billing System:** Fast search, barcode support, subtotal/tax/discount calculations, and print-ready invoices.
6. **Returns & Adjustments:** Audited stock adjustments and verified customer returns referencing original sales.
7. **Stock Movement Ledger:** Immutable ledger capturing all stock inflows, deductions, balances, reasons, and responsible user IDs.
8. **Real-time Alerts & Analytics:** Low-stock threshold warnings, near-expiry alerts, daily sales metrics, and stock reconciliation.

---

## 5. Getting Started (Local Development)

### Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **MongoDB:** v6.0+ local server running, or a MongoDB Atlas URI

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Charan57290/Algions.git
   cd Algions
   ```

2. **Environment Configuration:**
   Copy the example environment files:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```

3. **Install Dependencies:**
   ```bash
   # Root
   npm install

   # Backend
   cd backend && npm install

   # Frontend
   cd ../frontend && npm install
   ```

4. **Run the Development Servers:**
   ```bash
   # From root directory:
   npm run dev:backend   # Starts Express backend on http://localhost:5000
   npm run dev:frontend  # Starts Vite frontend on http://localhost:5173
   ```

5. **Verify Installation:**
   Open `http://localhost:5173` in your browser. The frontend status card should indicate a healthy connection to `http://localhost:5000/api/health`.

---

## 6. Development Roadmap

- [x] **Phase 0:** Repository inspection, Git authentication, and architectural specification
- [x] **Phase 1:** Initial project foundation, modular directory structure, and environment configuration
- [ ] **Phase 2:** Database Architecture & Mongoose Schemas (User, Medicine, Batch, Movement)
- [ ] **Phase 3:** Authentication & Role-Based Authorization (JWT, bcrypt, Middleware)
- [ ] **Phase 4:** Master Data Management (Medicines, Categories, Suppliers)
- [ ] **Phase 5:** Batch-Based Inventory & FEFO Allocation Engine
- [ ] **Phase 6:** Purchases & Stock Receiving Workflows
- [ ] **Phase 7:** Sales, POS Billing & Invoice Generation
- [ ] **Phase 8:** Returns, Stock Adjustments & Immutable Movement Audit Trail
- [ ] **Phase 9:** Inventory Alerts, Valuation & Analytical Reports
- [ ] **Phase 10:** Responsive Frontend UI Integration & Interactive Portals
- [ ] **Phase 11:** Automated Testing Suite (Unit & Integration)
- [ ] **Phase 12:** Production Deployment & Final Assessment Package

---

## 7. License

Algions AI Labs Assessment Project. Developed by Thota Kalicharan.

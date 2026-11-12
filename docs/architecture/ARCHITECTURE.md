# Pharmacy Management System — System Architecture

**Algions AI Labs | Full-Stack Internship Assessment**  
**Author:** Thota Kalicharan (Charan57290)

---

## 1. High-Level Architectural Overview

The application follows a clean, 3-tier modular architecture designed for high maintainability, type safety, auditability, and data integrity:

```
┌────────────────────────────────────────────────────────┐
│               Frontend Presentation Layer              │
│       React 18 + Vite + TypeScript + Tailwind CSS      │
│  (State Contexts, POS Interface, Role-Based Portals)   │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs / JSON / JWT
┌───────────────────────────▼────────────────────────────┐
│          Backend API & Business Logic Layer            │
│         Node.js + Express.js + TypeScript              │
│  (Auth, RBAC, FEFO Engine, POS Invoicing, Validation)  │
└───────────────────────────┬────────────────────────────┘
                            │ Mongoose ODM / Replica Set
┌───────────────────────────▼────────────────────────────┐
│            Persistence & Data Storage Layer            │
│                 MongoDB (Mongoose Models)              │
│   (Users, Batches, Movements, Invoices, Audit Logs)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Layered Responsibilities

### 2.1 Presentation Layer (Frontend)
- **Role-Based Views:** Tailored dashboards for Administrators, Pharmacists/Staff, and Customers.
- **Point of Sale (POS):** Fast-action cashier screen with barcode/SKU search, real-time stock availability, instant item calculation, discounts, and print-ready invoices.
- **Inventory & Alert Center:** Real-time visual monitoring for low-stock indicators and near-expiry batch warnings.
- **State Management & Validation:** React Context for Auth and Cart; Zod + React Hook Form for type-safe form validation.

### 2.2 Application & Business Layer (Backend)
- **Authentication & RBAC:** JWT authentication with bcrypt-hashed credentials and server-side role authorization guards (`requireAuth`, `requireRole('admin')`).
- **FEFO Allocation Engine:** Algorithmic First-Expiry-First-Out batch selection ensuring oldest active stock is depleted first while strictly rejecting expired items.
- **Stock Movement Engine:** Every transaction (Purchase, Sale, Return, Adjustment) produces an immutable `StockMovement` ledger entry.
- **Centralized Error & Validation Middleware:** Zod schema validation on incoming payloads, standardized API response structures.

### 2.3 Persistence Layer (Database)
- **Mongoose ODM:** Explicit schemas, compound indexes (e.g., medicine + expiry for FEFO optimization), and strict validation rules.
- **Auditability:** Complete historical traceability with opening stock balances, movement deltas, user attributions, and timestamps.

---

## 3. Core Business Rules

1. **Batch Isolation:** Inventory is tracked at the discrete batch level (not single aggregated numbers).
2. **Strict Expiry Guard:** Expired batches cannot be allocated or sold under any circumstances.
3. **Non-Negative Stock Guarantee:** Stock transactions enforce atomic availability checks before deducting units.
4. **Immutable Movements:** Stock movements cannot be edited or deleted once written.

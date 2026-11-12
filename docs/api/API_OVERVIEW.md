# Pharmacy Management System — REST API Overview

All API endpoints follow RESTful conventions, returning standardized JSON payloads.

## Standard Response Structure

### Success
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

---

## Endpoint Modules (Planned & Implemented)

### 1. Health & Status
- `GET /api/health` - System health, database connection state, and uptime.

### 2. Authentication & Users (`/api/auth`, `/api/users`)
- `POST /api/auth/register` - Create user account (Admin only for staff).
- `POST /api/auth/login` - Authenticate with email/password, returns JWT token.
- `GET /api/auth/me` - Retrieve authenticated user profile.
- `GET /api/users` - List users with role filtering (Admin).

### 3. Medicines & Categories (`/api/medicines`, `/api/categories`)
- `GET /api/medicines` - Paginated list of medicines with search & filter.
- `POST /api/medicines` - Register new medicine SKU.
- `GET /api/medicines/:id` - Medicine details.
- `PUT /api/medicines/:id` - Update medicine metadata.
- `DELETE /api/medicines/:id` - Deactivate/archive medicine.
- `GET /api/categories` - Medicine categories.

### 4. Suppliers (`/api/suppliers`)
- `GET /api/suppliers` - List pharmaceutical suppliers.
- `POST /api/suppliers` - Register new supplier.
- `GET /api/suppliers/:id` - Supplier details and purchase history.

### 5. Batches & Inventory (`/api/batches`)
- `GET /api/batches` - List active batches with expiry & quantity.
- `GET /api/batches/fefo/:medicineId` - Preview FEFO allocation for medicine.
- `GET /api/batches/valuation` - Total stock valuation report.

### 6. Purchases (`/api/purchases`)
- `POST /api/purchases` - Receive supplier purchase invoice and create batches.
- `GET /api/purchases` - Purchase history with itemized batch breakdown.

### 7. Sales & POS (`/api/sales`)
- `POST /api/sales` - Process sale with automatic FEFO batch allocation.
- `GET /api/sales` - Sales history.
- `GET /api/sales/:id/invoice` - Printable invoice data.

### 8. Returns & Adjustments (`/api/returns`, `/api/adjustments`)
- `POST /api/returns` - Process customer return with original invoice check.
- `POST /api/adjustments` - Stock adjustment with audited reason.

### 9. Stock Movements & Audit (`/api/movements`)
- `GET /api/movements` - Immutable stock ledger with balance tracking.

### 10. Reports & Dashboard (`/api/reports`)
- `GET /api/reports/dashboard` - Summary KPIs, revenue, low stock count.
- `GET /api/reports/alerts/low-stock` - Medicines below reorder threshold.
- `GET /api/reports/alerts/near-expiry` - Batches approaching expiration.

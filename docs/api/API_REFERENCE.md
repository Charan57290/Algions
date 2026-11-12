# Pharmacy Management System — REST API Reference
**Algions AI Labs Private Limited | Full-Stack Internship Assessment**

---

## 1. Overview & Architectural Principles

The Pharmacy Management System exposes a RESTful HTTP API built using Node.js, Express.js, TypeScript, and MongoDB (via Mongoose). All endpoints communicate using standard JSON payloads (`Content-Type: application/json`), follow conventional HTTP status codes, and enforce server-side validation using Zod.

### Global Base URL
- Local Development: `http://localhost:5000/api`
- Production (Render): `https://<render-service-name>.onrender.com/api`

### Standard Response Envelope
All API endpoints return responses encapsulated in a consistent JSON structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

Error responses conform to the following schema:
```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": [ ... ]
}
```

### Authentication Header
Protected endpoints require an `Authorization` header containing a valid JSON Web Token (JWT):
```http
Authorization: Bearer <jwt-token>
```

---

## 2. Authentication & User Management

### `POST /api/auth/register`
Creates a new customer account.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password@123",
    "phone": "+91 98765 43210"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "_id": "6789...",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "CUSTOMER"
      }
    }
  }
  ```

### `POST /api/auth/login`
Authenticates credentials and returns a signed JWT.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "pharmacist@pharmacy.com",
    "password": "Pharmacist@123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "_id": "6789...",
        "name": "Lead Pharmacist",
        "email": "pharmacist@pharmacy.com",
        "role": "PHARMACIST"
      }
    }
  }
  ```

### `GET /api/auth/me`
Retrieves the profile of the currently authenticated user.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`, `CUSTOMER`)
- **Response (200 OK):** Current user object.

### `GET /api/users`
Lists all registered system accounts.
- **Access:** Restricted to `ADMIN`
- **Response (200 OK):** Array of user documents.

### `PATCH /api/users/:id/status`
Toggles active or suspended status for a user.
- **Access:** Restricted to `ADMIN`
- **Request Body:** `{ "isActive": false }`
- **Response (200 OK):** Updated user document.

---

## 3. Master Data Management

### `GET /api/categories`
Lists therapeutic medicine categories.
- **Access:** Authenticated
- **Query Parameters:** `search`, `isActive`
- **Response (200 OK):** Array of category objects.

### `POST /api/categories`
Creates a new category.
- **Access:** Restricted to `ADMIN`
- **Request Body:** `{ "name": "Analgesics", "description": "Pain relief" }`

### `GET /api/suppliers`
Lists authorized pharmaceutical suppliers and distributors.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Query Parameters:** `search`, `status`
- **Response (200 OK):** Array of supplier objects.

### `POST /api/suppliers`
Registers a new supplier.
- **Access:** Restricted to `ADMIN`
- **Request Body:**
  ```json
  {
    "name": "Apex Healthcare Logistics",
    "supplierCode": "SUPP-APEX-01",
    "contactPerson": "Vikram Sharma",
    "phone": "+91 98765 11111",
    "email": "orders@apexhealth.com",
    "gstin": "27AABCU9603R1ZM",
    "address": "Pharma City, Bengaluru"
  }
  ```

### `GET /api/medicines`
Queries pharmaceutical catalogue with aggregated non-expired stock and reorder warnings.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`, `CUSTOMER`)
- **Query Parameters:** `search`, `category`, `dosageForm`, `lowStockOnly`, `page`, `limit`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "medicines": [
        {
          "_id": "6789...",
          "medicineCode": "MED-PARA-500",
          "name": "Paracetamol 500mg Tablets",
          "genericName": "Acetaminophen",
          "brandName": "Dolo",
          "dosageForm": "TABLET",
          "strength": "500mg",
          "unitOfMeasurement": "STRIP",
          "reorderThreshold": 20,
          "totalAvailableStock": 140,
          "isLowStock": false
        }
      ],
      "total": 45,
      "page": 1,
      "totalPages": 3
    }
  }
  ```

### `POST /api/medicines`
Registers a new medicine SKU.
- **Access:** Restricted to `ADMIN`

---

## 4. Discrete Batch Inventory & FEFO Engine

### `GET /api/batches`
Lists discrete batches with manufacturing dates, expiry dates, and unit quantities.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Query Parameters:** `medicine`, `status` (`ACTIVE`, `NEAR_EXPIRY`, `EXPIRED`, `DEPLETED`), `page`, `limit`

### `GET /api/batches/fefo-preview`
Calculates optimal FEFO lot allocation for a medicine without mutating database state.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Query Parameters:** `medicine` (ObjectId), `quantity` (number)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "medicineId": "6789...",
      "requestedQuantity": 15,
      "totalAllocated": 15,
      "isSufficient": true,
      "allocations": [
        {
          "batchId": "6789...",
          "batchNumber": "LOT-2026A",
          "expiryDate": "2026-12-31T00:00:00.000Z",
          "allocatedQuantity": 10,
          "unitSellingPrice": 35.0,
          "batchRemainingStock": 0
        },
        {
          "batchId": "6790...",
          "batchNumber": "LOT-2026B",
          "expiryDate": "2027-06-30T00:00:00.000Z",
          "allocatedQuantity": 5,
          "unitSellingPrice": 35.0,
          "batchRemainingStock": 45
        }
      ]
    }
  }
  ```

### `GET /api/batches/valuation`
Calculates real-time inventory valuation.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Response (200 OK):**
  ```json
  {
    "totalBatchesCount": 24,
    "totalAvailableUnits": 1250,
    "totalCostValuation": 25000.0,
    "totalRetailValuation": 42500.0,
    "potentialGrossProfit": 17500.0,
    "expiredBatchesCount": 1,
    "expiredValuationLoss": 850.0
  }
  ```

---

## 5. Purchases & Goods Receiving (Stock Inward)

### `POST /api/purchases`
Processes incoming supplier consignment, ingests batches, updates inventory, and writes audit movements.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Request Body:**
  ```json
  {
    "supplierId": "6789...",
    "supplierInvoiceNumber": "INV-SUPP-9921",
    "purchaseDate": "2026-11-13",
    "items": [
      {
        "medicineId": "6789...",
        "batchNumber": "LOT-AMOX-01",
        "manufacturingDate": "2026-01-01",
        "expiryDate": "2027-06-30",
        "purchasePrice": 20.0,
        "sellingPrice": 35.0,
        "quantity": 100
      }
    ],
    "notes": "Verified cold storage compliance"
  }
  ```
- **Response (201 Created):** Generated purchase order document with `purchaseNumber: "PO-20261113-0001"`.

---

## 6. Point of Sale (POS) Billing & Invoicing

### `POST /api/sales`
Executes an atomic point of sale transaction. Automatically allocates earliest-expiring active batches via FEFO, records cost snapshots, generates sequential invoice numbers, and writes double-entry stock movement records.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Request Body:**
  ```json
  {
    "customer": {
      "name": "Ramesh Kumar",
      "phone": "9876543210"
    },
    "items": [
      {
        "medicineId": "6789...",
        "quantity": 10
      }
    ],
    "paymentMethod": "UPI",
    "totalDiscount": 10.0,
    "taxRate": 12,
    "notes": "Dispensed under Dr. Gupta prescription"
  }
  ```
- **Response (201 Created):** Completed sale record with `invoiceNumber: "INV-202611-0001"`.

### `GET /api/sales/:id/invoice`
Retrieves a complete, print-ready pharmaceutical tax invoice.
- **Access:** Authenticated
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "pharmacyHeader": {
        "storeName": "Algions Pharmacy",
        "address": "Health City Avenue, Bengaluru",
        "gstin": "29ABCDE1234F1Z5",
        "drugLicenseNo": "KA-BNG-2026-DL-00452"
      },
      "invoiceMeta": {
        "invoiceNumber": "INV-202611-0001",
        "date": "2026-11-13T00:15:00.000Z",
        "paymentMethod": "UPI",
        "paymentStatus": "COMPLETED"
      },
      "items": [
        {
          "medicineName": "Amoxicillin 500mg Capsules",
          "batchNumber": "LOT-AMOX-01",
          "quantity": 10,
          "unitPrice": 35.0,
          "total": 350.0
        }
      ],
      "summary": {
        "subtotal": 350.0,
        "totalDiscount": 10.0,
        "taxAmount": 40.8,
        "grandTotal": 380.8
      }
    }
  }
  ```

---

## 7. Customer Returns & Stock Adjustments

### `POST /api/returns`
Processes customer returned goods. Validates return quantities against original sale invoice, computes refund, and controls restock safety (undamaged lots restored to active batch; damaged/expired lots quarantined).
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Request Body:**
  ```json
  {
    "saleId": "6789...",
    "overallReason": "Patient revised dosage",
    "items": [
      {
        "medicineId": "6789...",
        "batchId": "6789...",
        "quantityReturned": 2,
        "reason": "Prescription changed",
        "restockable": true
      }
    ]
  }
  ```

### `POST /api/adjustments`
Performs an audited physical stock adjustment. Enforces non-negative inventory protection and requires mandatory regulatory reason codes.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)
- **Request Body:**
  ```json
  {
    "batchId": "6789...",
    "adjustmentType": "DECREASE",
    "adjustedQuantity": 5,
    "reason": "DAMAGED_GOODS",
    "remarks": "Ampoule broken during routine shelving"
  }
  ```

---

## 8. Analytical Reports & Reconciliation

### `GET /api/reports/dashboard`
Aggregates high-level operational KPIs, 7-day sales velocity, low-stock warnings, and expiring batches.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)

### `GET /api/reports/sales`
Generates comprehensive sales and gross profit margin report across customizable date intervals.
- **Access:** Authenticated (`ADMIN`)

### `GET /api/reports/expiry-risk`
Classifies discrete batches into actionable regulatory risk tiers: `EXPIRED`, `CRITICAL` (≤7 days), `HIGH` (≤30 days), `MODERATE` (≤90 days), and `HEALTHY`.
- **Access:** Authenticated (`ADMIN`, `PHARMACIST`)

### `GET /api/reports/reconciliation`
Runs a mathematical double-entry audit algorithm across all stock movements:
$$\text{Calculated Stock} = \text{Opening} + \text{Inward} + \text{Customer Returns} - \text{Sales} \pm \text{Adjustments}$$
Verifies $\text{Calculated Stock} == \text{Current Batch Balance}$.
- **Access:** Restricted to `ADMIN`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "totalBatchesAudited": 24,
      "totalDiscrepancies": 0,
      "reconciliationStatus": "PERFECTLY_RECONCILED",
      "batches": [ ... ]
    }
  }
  ```

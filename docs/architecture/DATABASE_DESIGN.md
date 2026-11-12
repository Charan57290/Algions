# Pharmacy Management System — Database Architecture & ER Design

**Algions AI Labs | Full-Stack Internship Assessment**  
**Author:** Thota Kalicharan ([@Charan57290](https://github.com/Charan57290))

---

## 1. Architectural Principles & Schema Decisions

### 1.1 Discrete Batch Tracking vs. Aggregate Inventory
Traditional retail systems often maintain a single `quantity` field on a product table. In pharmaceuticals, this approach is catastrophic:
- Medicines expire at specific dates.
- Regulatory recalls apply to specific lot/batch numbers.
- Purchase costs fluctuate per consignment.

**Our Architecture:**
- The `Medicine` collection stores immutable master catalog data (chemical formula, generic name, brand, dosage form, strength, SKU, and barcode).
- The `Batch` collection tracks individual production lots with distinct manufacturing dates, expiration dates, purchase prices, selling prices, and real-time available quantities.
- Every sale or deduction depletes units directly from designated batches, never from an abstract medicine counter.

### 1.2 FEFO (First-Expiry-First-Out) Optimization Index
To execute real-time FEFO allocation in sub-millisecond queries, the `Batch` collection employs a high-performance compound index:
```javascript
BatchSchema.index({ medicine: 1, expiryDate: 1, availableQuantity: 1 });
```
When a customer requests $N$ units of Medicine $M$, the database fetches active batches where `availableQuantity > 0` and `expiryDate > currentDate`, sorted ascending by `expiryDate`.

### 1.3 Immutable Double-Entry Stock Movement Ledger
To ensure complete reconcilability, no inventory quantity is ever updated silently. Every purchase received, sale completed, customer return, or audited adjustment writes an immutable record to the `StockMovement` collection:
- `previousBalance`
- `quantityAdded`
- `quantityRemoved`
- `newBalance`
- `movementType`
- `relatedTransactionId`
- `user` (staff member responsible)

---

## 2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    CATEGORY ||--o{ MEDICINE : "classifies"
    SUPPLIER ||--o{ BATCH : "supplies"
    SUPPLIER ||--o{ PURCHASE : "receives_from"
    MEDICINE ||--o{ BATCH : "has_batches"
    MEDICINE ||--o{ STOCK_MOVEMENT : "tracked_in"
    BATCH ||--o{ STOCK_MOVEMENT : "depleted_or_added"
    PURCHASE ||--o{ PURCHASE_ITEM : "contains"
    PURCHASE_ITEM ||--o{ BATCH : "creates"
    SALE ||--o{ SALE_ITEM : "contains"
    SALE_ITEM }o--|| BATCH : "allocates_from"
    SALE ||--o{ RETURN : "referenced_by"
    RETURN ||--o{ RETURN_ITEM : "contains"
    BATCH ||--o{ STOCK_ADJUSTMENT : "adjusted"
    USER ||--o{ SALE : "cashier"
    USER ||--o{ PURCHASE : "received_by"
    USER ||--o{ RETURN : "processed_by"
    USER ||--o{ STOCK_ADJUSTMENT : "adjusted_by"
    USER ||--o{ STOCK_MOVEMENT : "authorized_by"
    USER ||--o{ AUDIT_LOG : "performed_by"

    CATEGORY {
        ObjectId _id PK
        string name UK
        string slug UK
        string description
        boolean isActive
    }

    SUPPLIER {
        ObjectId _id PK
        string supplierCode UK
        string name
        string contactPerson
        string phone
        string email
        string gstin
        string status
    }

    MEDICINE {
        ObjectId _id PK
        string medicineCode UK
        string name
        string genericName
        string brandName
        ObjectId category FK
        string manufacturer
        string dosageForm
        string strength
        string barcode UK
        string sku UK
        string unitOfMeasurement
        number reorderThreshold
        boolean isActive
    }

    BATCH {
        ObjectId _id PK
        ObjectId medicine FK
        string batchNumber
        ObjectId supplier FK
        date manufacturingDate
        date expiryDate
        number purchasePrice
        number sellingPrice
        number initialQuantity
        number availableQuantity
        ObjectId purchase FK
    }

    PURCHASE {
        ObjectId _id PK
        string purchaseNumber UK
        ObjectId supplier FK
        date purchaseDate
        string supplierInvoiceNumber
        number subtotal
        number taxAmount
        number totalAmount
        string paymentStatus
        ObjectId receivedBy FK
    }

    SALE {
        ObjectId _id PK
        string invoiceNumber UK
        object customer
        number subtotal
        number totalDiscount
        number taxRate
        number taxAmount
        number grandTotal
        string paymentMethod
        string status
        ObjectId cashier FK
    }

    RETURN {
        ObjectId _id PK
        string returnNumber UK
        ObjectId sale FK
        string invoiceNumber
        number totalRefundAmount
        string overallReason
        ObjectId processedBy FK
    }

    STOCK_MOVEMENT {
        ObjectId _id PK
        ObjectId medicine FK
        ObjectId batch FK
        string movementType
        number quantityAdded
        number quantityRemoved
        number previousBalance
        number newBalance
        string reason
        string relatedTransactionId
        ObjectId user FK
    }

    STOCK_ADJUSTMENT {
        ObjectId _id PK
        string adjustmentNumber UK
        ObjectId medicine FK
        ObjectId batch FK
        string adjustmentType
        number previousQuantity
        number adjustedQuantity
        number newQuantity
        string reason
        string remarks
        ObjectId adjustedBy FK
    }

    AUDIT_LOG {
        ObjectId _id PK
        string action
        string entity
        string entityId
        ObjectId performedBy FK
        object details
        string ipAddress
        date createdAt
    }
```

---

## 3. Entity Specification

| Entity | Primary Responsibility | Key Constraints & Indexes |
| :--- | :--- | :--- |
| **User** | Authentication & RBAC (`ADMIN`, `PHARMACIST`, `CUSTOMER`) | Unique index on `email`, bcrypt hashed passwords. |
| **Category** | Drug classification & filtering | Unique index on `name` and `slug`. |
| **Supplier** | Pharmaceutical vendors & logistics partners | Unique index on `supplierCode`. |
| **Medicine** | Master pharmaceutical catalog | Unique indices on `medicineCode`, `sku`, `barcode`. Full-text index on search attributes. |
| **Batch** | Discrete lot inventory with expiry dates | Compound unique `{ medicine: 1, batchNumber: 1 }`. Compound index `{ medicine: 1, expiryDate: 1, availableQuantity: 1 }`. |
| **Purchase** | Inward inventory consignments | Unique index on `purchaseNumber`. |
| **Sale** | POS customer billing & invoicing | Unique index on `invoiceNumber`. Index on `createdAt`. |
| **Return** | Customer returns linked to original sale | Unique index on `returnNumber`. Foreign key reference to `Sale`. |
| **StockMovement** | Immutable stock ledger | Indices on `batch`, `medicine`, and `createdAt`. |
| **StockAdjustment** | Audited physical stock modifications | Unique `adjustmentNumber`. Mandatory reason enum. |
| **AuditLog** | System-wide immutable security trail | Read-only once written; timestamps on every event. |

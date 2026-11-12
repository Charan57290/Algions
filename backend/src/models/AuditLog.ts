import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  STATUS_CHANGE = 'STATUS_CHANGE',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  VOID_TRANSACTION = 'VOID_TRANSACTION',
}

export enum AuditEntity {
  USER = 'USER',
  MEDICINE = 'MEDICINE',
  CATEGORY = 'CATEGORY',
  SUPPLIER = 'SUPPLIER',
  BATCH = 'BATCH',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
}

export interface IAuditLog extends Document {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  performedBy?: Types.ObjectId;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    entity: {
      type: String,
      enum: Object.values(AuditEntity),
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      trim: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Audit records are immutable once created
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;

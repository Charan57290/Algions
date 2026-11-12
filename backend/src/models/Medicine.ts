import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum DosageForm {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  OINTMENT = 'OINTMENT',
  DROPS = 'DROPS',
  INHALER = 'INHALER',
  POWDER = 'POWDER',
  OTHER = 'OTHER',
}

export enum UnitOfMeasurement {
  STRIP = 'STRIP',
  BOTTLE = 'BOTTLE',
  BOX = 'BOX',
  VIAL = 'VIAL',
  TUBE = 'TUBE',
  PIECE = 'PIECE',
  PACK = 'PACK',
}

export interface IMedicine extends Document {
  medicineCode: string;
  name: string;
  genericName: string;
  brandName: string;
  category: Types.ObjectId;
  manufacturer: string;
  description?: string;
  dosageForm: DosageForm;
  strength: string;
  barcode: string;
  sku: string;
  unitOfMeasurement: UnitOfMeasurement;
  reorderThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>(
  {
    medicineCode: {
      type: String,
      required: [true, 'Medicine code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      maxlength: [200, 'Medicine name cannot exceed 200 characters'],
      index: true,
    },
    genericName: {
      type: String,
      required: [true, 'Generic chemical name is required'],
      trim: true,
      index: true,
    },
    brandName: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Medicine category is required'],
      index: true,
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    dosageForm: {
      type: String,
      enum: Object.values(DosageForm),
      required: [true, 'Dosage form is required'],
      default: DosageForm.TABLET,
    },
    strength: {
      type: String,
      required: [true, 'Strength specification is required (e.g., 500mg)'],
      trim: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    unitOfMeasurement: {
      type: String,
      enum: Object.values(UnitOfMeasurement),
      required: [true, 'Unit of measurement is required'],
      default: UnitOfMeasurement.STRIP,
    },
    reorderThreshold: {
      type: Number,
      required: [true, 'Reorder threshold is required'],
      min: [0, 'Reorder threshold cannot be negative'],
      default: 20,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for fast multi-field search
MedicineSchema.index({
  name: 'text',
  genericName: 'text',
  brandName: 'text',
  manufacturer: 'text',
  sku: 'text',
  barcode: 'text',
});

export const Medicine: Model<IMedicine> =
  mongoose.models.Medicine || mongoose.model<IMedicine>('Medicine', MedicineSchema);
export default Medicine;

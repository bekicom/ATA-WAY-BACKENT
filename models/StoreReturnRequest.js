import mongoose from "mongoose";

const storeReturnRequestSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, required: true, trim: true },
    productBarcode: { type: String, default: "", trim: true },
    unit: { type: String, default: "dona", trim: true },
    requestedQty: { type: Number, required: true, min: 0.0001 },
    qtyReserved: { type: Boolean, default: false },
    approvedQty: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestNote: { type: String, default: "", trim: true },
    decisionNote: { type: String, default: "", trim: true },
    sourceRequestId: { type: String, default: "", trim: true, index: true },
    sourceStoreCode: { type: String, default: "", trim: true },
    sourceStoreName: { type: String, default: "", trim: true },
    requestedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    requestedByUsername: { type: String, required: true, trim: true },
    approvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    approvedByUsername: { type: String, default: "", trim: true },
    requestedAt: { type: Date, default: Date.now, index: true },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

storeReturnRequestSchema.index({ status: 1, createdAt: -1 });
storeReturnRequestSchema.index({ productId: 1, status: 1 });
storeReturnRequestSchema.index({ sourceRequestId: 1, sourceStoreCode: 1 });

export const StoreReturnRequest = mongoose.model("StoreReturnRequest", storeReturnRequestSchema);

import { Purchase } from "../models/Purchase.js";
import { Supplier } from "../models/Supplier.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listPurchases = asyncHandler(async (req, res) => {
  const query = {};
  const supplierId = String(req.query.supplierId || "").trim();
  const productId = String(req.query.productId || "").trim();
  const entryType = String(req.query.entryType || "").trim();
  const search = String(req.query.q || "").trim();
  const dateFrom = String(req.query.dateFrom || "").trim();
  const dateTo = String(req.query.dateTo || "").trim();

  if (supplierId) query.supplierId = supplierId;
  if (productId) query.productId = productId;
  if (entryType) query.entryType = entryType;
  if (dateFrom || dateTo) {
    query.purchasedAt = {};
    if (dateFrom) query.purchasedAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) query.purchasedAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: "i" } },
      { productName: { $regex: search, $options: "i" } },
      { productModel: { $regex: search, $options: "i" } },
      { note: { $regex: search, $options: "i" } },
    ];
  }

  const purchases = await Purchase.find(query)
    .populate({ path: "supplierId", select: "name code" })
    .populate({ path: "productId", select: "name code barcode" })
    .sort({ purchasedAt: -1, createdAt: -1 })
    .lean();

  return res.json({ purchases });
});

export const getSupplierPurchaseReport = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id).lean();
  if (!supplier) {
    return res.status(404).json({ message: "Yetkazib beruvchi topilmadi" });
  }

  const purchases = await Purchase.find({ supplierId: supplier._id })
    .sort({ purchasedAt: -1 })
    .lean();

  const daily = purchases.reduce((acc, item) => {
    const key = new Date(item.purchasedAt).toISOString().slice(0, 10);
    const current = acc.get(key) || {
      date: key,
      totalCost: 0,
      totalPaid: 0,
      totalDebt: 0,
      items: 0,
      quantity: 0,
    };
    current.totalCost += Number(item.totalCost || 0);
    current.totalPaid += Number(item.paidAmount || 0);
    current.totalDebt += Number(item.debtAmount || 0);
    current.items += 1;
    current.quantity += Number(item.quantity || 0);
    acc.set(key, current);
    return acc;
  }, new Map());

  return res.json({
    supplier,
    purchases,
    daily: [...daily.values()].sort((a, b) => b.date.localeCompare(a.date)),
  });
});

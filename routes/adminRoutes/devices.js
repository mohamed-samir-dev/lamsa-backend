const express = require("express");
const router = express.Router();
const { authMiddleware } = require("./middleware");
const {
  listDeviceLogs,
  listBlockedDevices,
  blockDevice,
  unblockDevice,
} = require("../../services/deviceService");
const BlockedDevice = require("../../models/BlockedDevice");
const DeviceLog = require("../../models/DeviceLog");

// GET /api/devices/check?fp=xxx&ip=xxx  (called from Next.js middleware)
router.get("/check", async (req, res) => {
  try {
    const fp = typeof req.query.fp === "string" ? req.query.fp.slice(0, 64) : null;
    const ip = typeof req.query.ip === "string" ? req.query.ip.slice(0, 45) : null;
    const { findBlockedDevice } = require("../../services/deviceService");
    const blocked = await findBlockedDevice(fp, ip);
    return res.json({ blocked: !!blocked });
  } catch {
    res.json({ blocked: false });
  }
});

// GET /api/admin/devices/logs
router.get("/devices/logs", authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.slice(0, 100) : "";
    const data = await listDeviceLogs({ page, limit, search });
    res.json({ success: true, ...data });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// GET /api/admin/devices/blocked
router.get("/devices/blocked", authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.slice(0, 100) : "";
    const data = await listBlockedDevices({ page, limit, search });
    res.json({ success: true, ...data });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// POST /api/admin/devices/block
router.post("/devices/block", authMiddleware, async (req, res) => {
  try {
    const { fingerprint, ip, userAgent, reason } = req.body;
    if (!reason || (!fingerprint && !ip)) {
      return res.status(400).json({ success: false, error: "السبب والـ fingerprint أو IP مطلوبان" });
    }
    const record = await blockDevice({
      fingerprint: fingerprint || null,
      ip: ip || null,
      userAgent: userAgent || null,
      reason: String(reason).slice(0, 200),
      blockedBy: req.admin?.email || "admin",
    });

    // حذف السجل من سجل الزوار بعد الحظر
    const query = {};
    if (fingerprint) query.fingerprint = fingerprint;
    else if (ip) query.ip = ip;
    if (Object.keys(query).length) await DeviceLog.deleteMany(query);

    res.status(201).json({ success: true, record });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// POST /api/admin/devices/unblock/:id
router.post("/devices/unblock/:id", authMiddleware, async (req, res) => {
  try {
    const record = await unblockDevice(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: "السجل غير موجود" });
    res.json({ success: true, record });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// DELETE /api/admin/devices/blocked/:id
router.delete("/devices/blocked/:id", authMiddleware, async (req, res) => {
  try {
    await BlockedDevice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// PATCH /api/admin/devices/log/:id/label
router.patch("/devices/log/:id/label", authMiddleware, async (req, res) => {
  try {
    const label = req.body.label ? String(req.body.label).slice(0, 100) : null;
    const doc = await DeviceLog.findByIdAndUpdate(
      req.params.id,
      { label },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: "السجل غير موجود" });
    res.json({ success: true, doc });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// DELETE /api/admin/devices/log/:id
router.delete("/devices/log/:id", authMiddleware, async (req, res) => {
  try {
    await DeviceLog.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

// DELETE /api/admin/devices/logs/all
router.delete("/devices/logs/all", authMiddleware, async (req, res) => {
  try {
    await DeviceLog.deleteMany({});
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "خطأ في الخادم" });
  }
});

module.exports = router;

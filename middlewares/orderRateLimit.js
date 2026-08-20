const DeviceRateLimit = require("../models/DeviceRateLimit");
const { getRealIP } = require("../utils/ipHelper");

const MAX_ORDERS = 3;            // عدد الطلبات المسموحة
const BLOCK_MS = 5 * 60 * 1000; // 5 دقائق حظر

async function orderRateLimit(req, res, next) {
  const fp = typeof req.headers["x-device-id"] === "string"
    ? req.headers["x-device-id"].slice(0, 128)
    : null;

  const ip = getRealIP(req);
  const deviceId = fp || (ip && ip !== "unknown" ? `ip:${ip}` : null);

  // لا يوجد معرف → ارفض
  if (!deviceId) {
    return res.status(429).json({
      success: false,
      code: "DEVICE_BLOCKED",
      message: "Too many orders. Please try again later.",
      retryAfter: 300,
    });
  }

  const now = new Date();

  const state = await DeviceRateLimit.findOne({ deviceId }).lean();

  // فحص الحظر النشط
  if (state?.blockedUntil && state.blockedUntil > now) {
    const retryAfter = Math.ceil((state.blockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      code: "DEVICE_BLOCKED",
      message: "Too many orders. Please try again later.",
      retryAfter,
    });
  }

  // حساب العداد — إذا انتهى الحظر نصفّر العداد
  const wasBlocked = state?.blockedUntil && state.blockedUntil <= now;
  const currentCount = wasBlocked ? 0 : (state?.consecutiveOrders ?? 0);
  const newCount = currentCount + 1;
  const willBlock = newCount > MAX_ORDERS;

  // Atomic update مع optimistic locking
  const filter = { deviceId, lastOrderAt: state?.lastOrderAt ?? null };
  const update = {
    $set: {
      lastOrderAt: now,
      consecutiveOrders: willBlock ? 0 : newCount,
      blockedUntil: willBlock ? new Date(now.getTime() + BLOCK_MS) : null,
    },
  };

  let result;
  if (state) {
    result = await DeviceRateLimit.findOneAndUpdate(filter, update, { new: true });
  } else {
    result = await DeviceRateLimit.findOneAndUpdate(
      { deviceId, lastOrderAt: null },
      { $setOnInsert: { deviceId }, ...update },
      { upsert: true, new: true }
    ).catch(() => null);
  }

  // race condition — طلب آخر سبق → ارفض
  if (!result) {
    return res.status(429).json({
      success: false,
      code: "DEVICE_BLOCKED",
      message: "Too many orders. Please try again later.",
      retryAfter: 300,
    });
  }

  // الطلب الرابع → حظر وارفض
  if (willBlock) {
    return res.status(429).json({
      success: false,
      code: "DEVICE_BLOCKED",
      message: "Too many orders. Please try again later.",
      retryAfter: Math.ceil(BLOCK_MS / 1000),
    });
  }

  next();
}

module.exports = { orderRateLimit };

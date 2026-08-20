const mongoose = require("mongoose");

const deviceRateLimitSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  lastOrderAt: { type: Date, default: null },
  consecutiveOrders: { type: Number, default: 0 },
  blockedUntil: { type: Date, default: null },
});

module.exports = mongoose.model("DeviceRateLimit", deviceRateLimitSchema);

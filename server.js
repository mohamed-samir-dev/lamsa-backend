require("dotenv").config();
const cluster = require("cluster");
const os = require("os");

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on("exit", () => cluster.fork());
} else {

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const adminRoutes = require("./routes/adminRoutes");

connectDB();

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",").map((o) => o.trim());

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { error: "طلبات كثيرة، حاول لاحقاً" } });
app.use("/api", globalLimiter);

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: "محاولات كثيرة، حاول بعد 15 دقيقة" } });
app.use("/api/admin/login", loginLimiter);

app.get("/", (req, res) => {
  res.json({ message: "API is running..." });
});


app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Cache middleware for product listing
app.use("/api/products", (req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
  }
  next();
}, productRoutes);
const checkoutLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { ok: false, error: "طلبات كثيرة، حاول لاحقاً" } });
app.use("/api/checkout", checkoutLimiter, checkoutRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Worker ${process.pid} running on port ${PORT}`));

} // end cluster worker

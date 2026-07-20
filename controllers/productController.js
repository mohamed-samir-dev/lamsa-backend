const Product = require("../models/Product");

// In-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

exports.invalidateCache = () => cache.clear();

function normalizeArabic(str) {
  return str
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

exports.getProducts = async (req, res) => {
  const { q, fields } = req.query;
  const selectFields = fields ? fields.replace(/,/g, " ") : "";

  if (!q) {
    const cacheKey = `products:${selectFields}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const query = Product.find().lean();
    if (selectFields) query.select(selectFields);
    const products = await query;
    setCached(cacheKey, products);
    return res.json(products);
  }

  // Search using MongoDB regex instead of fetching all then filtering in memory
  const normalized = normalizeArabic(q);
  const products = await Product.find({
    name: { $regex: normalized, $options: "i" },
  }).lean();
  res.json(products);
};

exports.getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
};

exports.createProduct = async (req, res) => {
  const product = await Product.create(req.body);
  exports.invalidateCache();
  res.status(201).json(product);
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!product) return res.status(404).json({ message: "Product not found" });
  exports.invalidateCache();
  res.json(product);
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  exports.invalidateCache();
  res.json({ message: "Product deleted" });
};

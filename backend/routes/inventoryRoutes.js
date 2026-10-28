const express = require("express");
const router = express.Router();

const {
  getInventory,
  getInventoryItem,
  stockIn,
  stockOut,
  adjustStock,
  getStockHistory,
} = require("../controllers/inventoryController");

// Get all inventory items
router.get("/", getInventory);

// Get stock history
router.get("/history", getStockHistory);

// Get inventory for a specific product
router.get("/:productId", getInventoryItem);

// Stock operations
router.post("/stock-in", stockIn);
router.post("/stock-out", stockOut);
router.post("/adjustment", adjustStock);

module.exports = router;
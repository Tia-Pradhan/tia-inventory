
const express = require("express");
const router = express.Router();

const {
  getWastageHistory,
  recordWastage,
  getWastageReport,
} = require("../controllers/wastageController");

router.get("/history", getWastageHistory);
router.get("/reports", getWastageReport);
router.post("/", recordWastage);

module.exports = router;


const express = require("express");
const router = express.Router();

const {
  getConsumptionHistory,
  getConsumptionSummary,
  createConsumption,
} = require("../controllers/consumptionController");

router.get("/history", getConsumptionHistory);
router.get("/summary", getConsumptionSummary);
router.post("/", createConsumption);

module.exports = router;

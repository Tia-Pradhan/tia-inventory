const express = require("express");
const router = express.Router();

const {
  getCustomers,
  addCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

router.get("/", getCustomers);
router.post("/", addCustomer);
router.delete("/:id", deleteCustomer);

module.exports = router;

const express = require("express");
const router = express.Router();

const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require("../controllers/menuItemController");

router.get("/", getMenuItems);
router.get("/:id", getMenuItem);
router.post("/", createMenuItem);
router.put("/:id", updateMenuItem);
router.delete("/:id", deleteMenuItem);

module.exports = router;
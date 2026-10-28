
const express = require("express");
const router = express.Router();

const {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  updateReservationStatus,
  deleteReservation,
} = require("../controllers/reservationController");

router.get("/", getReservations);
router.get("/:id", getReservationById);
router.post("/", createReservation);
router.put("/:id", updateReservation);
router.patch("/:id/status", updateReservationStatus);
router.delete("/:id", deleteReservation);

module.exports = router;

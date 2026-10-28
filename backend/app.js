
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { testDatabaseConnection } = require("./config/db");

const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const ingredientRoutes = require("./routes/ingredientRoutes");
const menuItemRoutes = require("./routes/menuItemRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const consumptionRoutes = require("./routes/consumptionRoutes");
const salesRoutes = require("./routes/salesRoutes");
const wastageRoutes = require("./routes/wastageRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const customerRoutes = require("./routes/customerRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Restaurant POS API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/consumption", consumptionRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/wastage", wastageRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await testDatabaseConnection();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start backend:", error.message);
    process.exit(1);
  }
}

startServer();

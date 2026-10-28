import api from "./api";

// Get all inventory items
export const getInventory = async () => {
  const response = await api.get("/inventory");
  return response.data;
};

// Get inventory for a specific product
export const getInventoryItem = async (productId) => {
  const response = await api.get(`/inventory/${productId}`);
  return response.data;
};

// Add stock
export const stockIn = async (stockData) => {
  const response = await api.post("/inventory/stock-in", stockData);
  return response.data;
};

// Remove stock
export const stockOut = async (stockData) => {
  const response = await api.post("/inventory/stock-out", stockData);
  return response.data;
};

// Set stock to a new quantity
export const adjustStock = async (stockData) => {
  const response = await api.post("/inventory/adjust", stockData);
  return response.data;
};

// Get stock movement history
export const getStockHistory = async () => {
  const response = await api.get("/inventory/history");
  return response.data;
};

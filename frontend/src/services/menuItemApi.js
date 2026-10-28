
import api from "./api";

// Get all menu items
export const getMenuItems = async () => {
  const response = await api.get("/menu-items");
  return response.data;
};

// Create a menu item
export const createMenuItem = async (data) => {
  const response = await api.post("/menu-items", data);
  return response.data;
};

// Update a menu item
export const updateMenuItem = async (id, data) => {
  const response = await api.put(`/menu-items/${id}`, data);
  return response.data;
};

// Delete a menu item
export const deleteMenuItem = async (id) => {
  const response = await api.delete(`/menu-items/${id}`);
  return response.data;
};

// Get calculated menu availability from MySQL
export const getMenuAvailability = async () => {
  const response = await api.get("/availability");
  return response.data;
};

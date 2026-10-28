
import api from "./api";

export const getIngredients = async () => {
  const response = await api.get("/ingredients");
  return response.data;
};

export const createIngredient = async (data) => {
  const response = await api.post("/ingredients", data);
  return response.data;
};

export const updateIngredient = async (id, data) => {
  const response = await api.put(`/ingredients/${id}`, data);
  return response.data;
};

export const deleteIngredient = async (id) => {
  const response = await api.delete(`/ingredients/${id}`);
  return response.data;
};

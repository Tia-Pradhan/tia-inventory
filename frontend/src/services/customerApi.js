
import api from "./api";

export const getCustomers = (search = "") =>
  api.get("/customers", {
    params: search.trim() ? { search: search.trim() } : {},
  });

export const createCustomer = (customer) =>
  api.post("/customers", customer);

export const updateCustomer = (id, customer) =>
  api.put(`/customers/${id}`, customer);

export const deleteCustomer = (id) =>
  api.delete(`/customers/${id}`);

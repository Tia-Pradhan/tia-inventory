
import api from "./api";

export async function getMenuAvailability() {
  const response = await api.get("/availability");
  return response.data;
}

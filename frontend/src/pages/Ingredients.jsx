
import { useEffect, useState } from "react";
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "../services/ingredientApi";
import "./Ingredients.css";

const emptyForm = {
  name: "",
  unit: "kg",
  quantity: 0,
  min_stock: 1,
  cost_per_unit: 0,
};

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadIngredients() {
    try {
      setLoading(true);
      setError("");

      const data = await getIngredients();
      setIngredients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load ingredients. Check your backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIngredients();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("Please enter an ingredient name.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      quantity: Number(form.quantity),
      min_stock: Number(form.min_stock),
      cost_per_unit: Number(form.cost_per_unit),
    };

    if (
      !Number.isFinite(payload.quantity) ||
      payload.quantity < 0 ||
      !Number.isFinite(payload.min_stock) ||
      payload.min_stock < 0 ||
      !Number.isFinite(payload.cost_per_unit) ||
      payload.cost_per_unit < 0
    ) {
      setError("Quantities, minimum stock and cost cannot be negative.");
      return;
    }

    try {
      if (editingId !== null) {
        await updateIngredient(editingId, payload);
        setMessage("Ingredient updated successfully.");
      } else {
        await createIngredient(payload);
        setMessage("Ingredient added successfully.");
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      await loadIngredients();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save ingredient. Check the backend API."
      );
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      unit: item.unit || "kg",
      quantity: item.quantity ?? 0,
      min_stock: item.min_stock ?? 1,
      cost_per_unit: item.cost_per_unit ?? 0,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete ingredient "${item.name}"?`)) return;

    try {
      setError("");
      setMessage("");

      await deleteIngredient(item.id);
      setMessage("Ingredient deleted successfully.");
      await loadIngredients();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete ingredient. It may be used in a recipe."
      );
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setMessage("");
  }

  return (
    <div className="ingredients-page">
      <div className="ingredients-page-header">
        <div>
          <h1>Ingredient Management</h1>
          <p>
            Manage recipe ingredients and their stock in your MySQL database.
          </p>
        </div>
      </div>

      {error && <div className="ingredient-alert ingredient-error">{error}</div>}

      {message && (
        <div className="ingredient-alert ingredient-success">{message}</div>
      )}

      <form className="ingredient-card" onSubmit={handleSubmit}>
        <h2>{editingId !== null ? "Edit Ingredient" : "Add Ingredient"}</h2>

        <div className="ingredient-form-grid">
          <label className="ingredient-field">
            <span>Ingredient Name *</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Onion"
              required
            />
          </label>

          <label className="ingredient-field">
            <span>Unit *</span>
            <select name="unit" value={form.unit} onChange={handleChange}>
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="litre">Litre</option>
              <option value="ml">Millilitre (ml)</option>
              <option value="piece">Piece</option>
              <option value="pack">Pack</option>
            </select>
          </label>

          <label className="ingredient-field">
            <span>Opening / Current Quantity *</span>
            <input
              type="number"
              name="quantity"
              min="0"
              step="0.001"
              value={form.quantity}
              onChange={handleChange}
              required
            />
          </label>

          <label className="ingredient-field">
            <span>Minimum Stock *</span>
            <input
              type="number"
              name="min_stock"
              min="0"
              step="0.001"
              value={form.min_stock}
              onChange={handleChange}
              required
            />
          </label>

          <label className="ingredient-field">
            <span>Cost per Unit (₹) *</span>
            <input
              type="number"
              name="cost_per_unit"
              min="0"
              step="0.01"
              value={form.cost_per_unit}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        <div className="ingredient-form-actions">
          <button type="submit" className="ingredient-btn ingredient-btn-primary">
            {editingId !== null ? "Update Ingredient" : "Add Ingredient"}
          </button>

          {editingId !== null && (
            <button
              type="button"
              className="ingredient-btn ingredient-btn-secondary"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="ingredient-card">
        <div className="ingredient-list-header">
          <h2>Ingredients in MySQL</h2>

          <button
            type="button"
            className="ingredient-btn ingredient-btn-secondary"
            onClick={loadIngredients}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="ingredient-empty">Loading ingredients...</p>
        ) : ingredients.length === 0 ? (
          <p className="ingredient-empty">
            No ingredients found. Add your first ingredient above.
          </p>
        ) : (
          <div className="ingredient-table-wrap">
            <table className="ingredient-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Min. Stock</th>
                  <th>Cost / Unit</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {ingredients.map((item) => (
                  <tr key={item.id}>
                    <td className="ingredient-name-cell">{item.name}</td>
                    <td>{item.unit}</td>
                    <td>{Number(item.quantity).toFixed(3)}</td>
                    <td>{Number(item.min_stock).toFixed(3)}</td>
                    <td>
                      ₹{Number(item.cost_per_unit || 0).toFixed(2)}
                    </td>
                    <td>
                      <div className="ingredient-row-actions">
                        <button
                          type="button"
                          className="ingredient-btn ingredient-btn-edit"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="ingredient-btn ingredient-btn-delete"
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


import { useEffect, useState } from "react";
import api from "../services/api";
import "./wastage.css";

const initialForm = {
  ingredient_id: "",
  quantity: "",
  reason: "SPOILAGE",
  notes: "",
};

const reasons = [
  { value: "SPOILAGE", label: "Spoilage" },
  { value: "EXPIRY", label: "Expiry" },
  { value: "PREPARATION_WASTE", label: "Preparation Waste" },
  { value: "DAMAGE", label: "Damage" },
  { value: "OVERPRODUCTION", label: "Overproduction" },
  { value: "OTHER", label: "Other" },
];

export default function Wastage() {
  const [ingredients, setIngredients] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setRefreshing(true);
    setError("");

    try {
      const response = await api.get("/ingredients");
      const data = response.data;

      const list = Array.isArray(data)
        ? data
        : data?.ingredients || data?.data || [];

      setIngredients(list);
    } catch (err) {
      console.error("Ingredients API error:", err);
      setIngredients([]);
      setError(
        "Unable to load ingredients. Check the /api/ingredients endpoint."
      );
    }

    try {
      const response = await api.get("/wastage/history");
      setRecords(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (err) {
      console.error("Wastage history API error:", err);
      setRecords([]);
      setError((previous) =>
        previous
          ? `${previous} Wastage history could not load.`
          : "Unable to load wastage history."
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const quantity = Number(form.quantity);

    if (!form.ingredient_id) {
      setError("Please select an ingredient.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Wasted quantity must be greater than zero.");
      return;
    }

    const selectedIngredient = ingredients.find(
      (item) => String(item.id) === String(form.ingredient_id)
    );

    if (
      selectedIngredient &&
      quantity > Number(selectedIngredient.quantity)
    ) {
      setError(
        `Insufficient stock. Available: ${selectedIngredient.quantity} ${selectedIngredient.unit || ""}`
      );
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/wastage", {
        ingredient_id: Number(form.ingredient_id),
        quantity,
        reason: form.reason,
        notes: form.notes.trim(),
        recorded_by: "Admin",
      });

      setMessage(
        response.data.message || "Wastage recorded successfully."
      );
      setForm({ ...initialForm });

      await loadData();
    } catch (err) {
      console.error("Save wastage error:", err);

      setError(
        err.response?.data?.message ||
          "Could not save wastage. Check the backend terminal for details."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  return (
    <div className="wastage-page">
      <div className="wastage-heading">
        <div>
          <h1>Wastage Management</h1>
          <p>Record wasted ingredients and track stock losses.</p>
        </div>

        <button
          type="button"
          className="wastage-refresh"
          onClick={loadData}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {message && (
        <div className="wastage-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="wastage-error" role="alert">
          {error}
        </div>
      )}

      <section className="wastage-card">
        <h2>Record Wastage</h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="ingredient_id">Ingredient</label>

          <select
            id="ingredient_id"
            name="ingredient_id"
            className="wastage-select"
            value={form.ingredient_id}
            onChange={handleChange}
            required
          >
            <option value="">Select an ingredient</option>

            {ingredients.map((ingredient) => (
              <option
                key={ingredient.id}
                value={ingredient.id}
              >
                {ingredient.name} — Stock:{" "}
                {ingredient.quantity ?? "Unknown"}{" "}
                {ingredient.unit || ""}
              </option>
            ))}
          </select>

          {ingredients.length === 0 && (
            <p className="wastage-hint">
              No ingredients available. Refresh or check the ingredients API.
            </p>
          )}

          <label htmlFor="quantity">Wasted Quantity</label>

          <input
            id="quantity"
            name="quantity"
            type="number"
            min="0.001"
            step="0.001"
            placeholder="Enter wasted quantity"
            value={form.quantity}
            onChange={handleChange}
            required
          />

          {form.ingredient_id && (
            <p className="wastage-stock-info">
              Available stock:{" "}
              {ingredients.find(
                (item) =>
                  String(item.id) === String(form.ingredient_id)
              )?.quantity ?? "—"}{" "}
              {ingredients.find(
                (item) =>
                  String(item.id) === String(form.ingredient_id)
              )?.unit ?? ""}
            </p>
          )}

          <label htmlFor="reason">Reason</label>

          <select
            id="reason"
            name="reason"
            className="wastage-select"
            value={form.reason}
            onChange={handleChange}
            required
          >
            {reasons.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>

          <label htmlFor="notes">Notes</label>

          <textarea
            id="notes"
            name="notes"
            rows="3"
            placeholder="Optional details about the wastage"
            value={form.notes}
            onChange={handleChange}
          />

          <button type="submit" disabled={loading || refreshing}>
            {loading ? "Saving..." : "Record Wastage"}
          </button>
        </form>
      </section>

      <section className="wastage-card">
        <h2>Wastage History</h2>
        <p className="wastage-record-count">
          Total records: <strong>{records.length}</strong>
        </p>

        <div className="wastage-table-wrap">
          <table className="wastage-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ingredient</th>
                <th>Quantity</th>
                <th>Reason</th>
                <th>Notes</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>

            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="wastage-empty">
                    No wastage records yet.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.ingredient_name}</td>
                    <td>
                      {record.quantity}{" "}
                      {record.ingredient_unit || ""}
                    </td>
                    <td>
                      {String(record.reason || "").replaceAll("_", " ")}
                    </td>
                    <td>{record.notes || "—"}</td>
                    <td>{formatDate(record.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

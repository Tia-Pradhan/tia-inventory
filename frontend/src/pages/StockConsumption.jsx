import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./stockConsumption.css";

const emptyForm = {
  ingredient_id: "",
  menu_item_id: "",
  quantity: "",
  notes: "",
};

function getRows(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

export default function StockConsumption() {
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // History filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.get("/ingredients"),
      api.get("/menu-items"),
      api.get("/consumption/history"),
      api.get("/consumption/summary"),
    ]);

    const labels = [
      "ingredients",
      "menu items",
      "consumption history",
      "consumption summary",
    ];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Failed to load ${labels[index]}:`, result.reason);
      }
    });

    setIngredients(
      results[0].status === "fulfilled" ? getRows(results[0].value) : []
    );
    setMenuItems(
      results[1].status === "fulfilled" ? getRows(results[1].value) : []
    );
    setHistory(
      results[2].status === "fulfilled" ? getRows(results[2].value) : []
    );
    setSummary(
      results[3].status === "fulfilled" ? getRows(results[3].value) : []
    );

    const failed = results
      .map((result, index) =>
        result.status === "rejected" ? labels[index] : null
      )
      .filter(Boolean);

    if (failed.length) {
      setError(`Could not load: ${failed.join(", ")}.`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const quantity = Number(form.quantity);

    if (!form.ingredient_id) {
      setError("Please select an ingredient.");
      return;
    }

    if (
      form.quantity === "" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    const selected = ingredients.find(
      (item) => String(item.id) === String(form.ingredient_id)
    );

    if (!selected) {
      setError("Ingredient not found. Refresh the page.");
      return;
    }

    if (quantity > Number(selected.quantity)) {
      setError(
        `Available stock is ${selected.quantity} ${selected.unit || ""}.`
      );
      return;
    }

    setSaving(true);

    try {
      const response = await api.post("/consumption", {
        ingredient_id: Number(form.ingredient_id),
        menu_item_id: form.menu_item_id
          ? Number(form.menu_item_id)
          : null,
        quantity,
        notes: form.notes.trim(),
      });

      setSuccess(
        response.data?.message || "Consumption recorded successfully."
      );

      setForm({ ...emptyForm });
      await loadData();
    } catch (err) {
      console.error("Consumption save error:", err.response?.data || err);

      setError(
        err.response?.data?.message ||
          "Could not record consumption. Check the backend terminal."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return history.filter((record) => {
      const searchableValues = [
        record.ingredient_name,
        record.menu_item_name,
        record.sale_reference,
        record.notes,
        record.source,
      ];

      const matchesSearch =
        !searchText ||
        searchableValues.some((value) =>
          String(value || "").toLowerCase().includes(searchText)
        );

      const recordDate = record.created_at
        ? new Date(record.created_at)
        : null;
      const validRecordDate =
        recordDate && !Number.isNaN(recordDate.getTime());

      const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const toDateExclusive = dateTo
        ? new Date(new Date(`${dateTo}T00:00:00`).getTime() + 86400000)
        : null;

      const matchesFrom =
        !fromDate ||
        (validRecordDate && recordDate >= fromDate);

      const matchesTo =
        !toDateExclusive ||
        (validRecordDate && recordDate < toDateExclusive);

      const matchesSource =
        sourceFilter === "all" ||
        String(record.source || "").toLowerCase() === sourceFilter;

      return matchesSearch && matchesFrom && matchesTo && matchesSource;
    });
  }, [history, search, sourceFilter, dateFrom, dateTo]);

  const totalRecords = history.length;

  return (
    <div className="consumption-page">
      <header className="consumption-heading">
        <div>
          <h1>Stock Consumption History</h1>
          <p>Track ingredient usage and stock deductions.</p>
        </div>

        <button
          type="button"
          className="consumption-secondary"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div className="consumption-alert consumption-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="consumption-alert consumption-success" role="status">
          {success}
        </div>
      )}

      <div className="consumption-stats">
        <div className="consumption-stat">
          <span>Consumption records</span>
          <strong>{totalRecords}</strong>
        </div>
        <div className="consumption-stat">
          <span>Ingredients tracked</span>
          <strong>{summary.length}</strong>
        </div>
        <div className="consumption-stat">
          <span>Automatic sale records</span>
          <strong>
            {history.filter(
              (record) => String(record.source || "").toLowerCase() === "sale"
            ).length}
          </strong>
        </div>
      </div>

      <section className="consumption-card">
        <h2>Record Manual Consumption</h2>
        <p>
          Use this form for ingredient usage that has not already been deducted
          through a sale.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="consumption-form-grid">
            <div className="consumption-field">
              <label htmlFor="consumption-ingredient">Ingredient *</label>
              <select
                id="consumption-ingredient"
                name="ingredient_id"
                value={form.ingredient_id}
                onChange={handleChange}
                required
              >
                <option value="">Select ingredient</option>
                {ingredients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.quantity} {item.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="consumption-field">
              <label htmlFor="consumption-quantity">Quantity Consumed *</label>
              <input
                id="consumption-quantity"
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                value={form.quantity}
                onChange={handleChange}
                placeholder="Enter quantity"
                required
              />
            </div>

            <div className="consumption-field">
              <label htmlFor="consumption-menu-item">Related Menu Item</label>
              <select
                id="consumption-menu-item"
                name="menu_item_id"
                value={form.menu_item_id}
                onChange={handleChange}
              >
                <option value="">General usage / none</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="consumption-field">
              <label htmlFor="consumption-notes">Notes</label>
              <textarea
                id="consumption-notes"
                name="notes"
                rows="3"
                maxLength="500"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional details"
              />
            </div>
          </div>

          <button
            type="submit"
            className="consumption-primary"
            disabled={saving || loading || ingredients.length === 0}
          >
            {saving ? "Saving..." : "Record Consumption"}
          </button>
        </form>
      </section>

      <section className="consumption-card">
        <h2>Consumption by Ingredient</h2>

        <div className="consumption-table-wrap">
          <table className="consumption-table">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Total Consumed</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item) => (
                <tr key={item.ingredient_id}>
                  <td>{item.ingredient_name}</td>
                  <td>{Number(item.total_consumed).toFixed(3)}</td>
                  <td>{item.unit || "—"}</td>
                </tr>
              ))}
              {!loading && summary.length === 0 && (
                <tr>
                  <td colSpan="3">No consumption totals yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="consumption-card">
        <h2>Consumption History</h2>

        <div className="consumption-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ingredient, menu item, sale..."
            aria-label="Search consumption history"
          />

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            aria-label="Filter by consumption source"
          >
            <option value="all">All sources</option>
            <option value="sale">Automatic sale</option>
            <option value="manual">Manual consumption</option>
          </select>

          <label>
            From
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="consumption-secondary"
            onClick={() => {
              setSearch("");
              setSourceFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear filters
          </button>
        </div>

        <p className="consumption-results-count">
          Showing {filteredHistory.length} of {history.length} records
        </p>

        <div className="consumption-table-wrap">
          <table className="consumption-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ingredient</th>
                <th>Menu Item</th>
                <th>Quantity</th>
                <th>Source</th>
                <th>Sale Reference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((record) => (
                <tr key={record.id}>
                  <td>
                    {record.created_at
                      ? new Date(record.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{record.ingredient_name}</td>
                  <td>{record.menu_item_name || "—"}</td>
                  <td>
                    {record.quantity} {record.unit || ""}
                  </td>
                  <td>
                    <span
                      className={`consumption-source consumption-source-${String(
                        record.source || "unknown"
                      ).toLowerCase()}`}
                    >
                      {record.source || "—"}
                    </span>
                  </td>
                  <td>{record.sale_reference || "—"}</td>
                  <td>{record.notes || "—"}</td>
                </tr>
              ))}
              {!loading && filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="7">
                    No consumption records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

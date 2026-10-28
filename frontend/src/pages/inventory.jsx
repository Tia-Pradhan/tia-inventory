
import { useEffect, useState } from "react";
import {
  getInventory,
  stockIn,
  stockOut,
  adjustStock,
  getStockHistory,
} from "../api/inventoryApi";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    productId: "",
    quantity: "",
    reason: "",
  });

  const loadData = async () => {
    try {
      setError("");

      const [inventoryData, historyData] = await Promise.all([
        getInventory(),
        getStockHistory(),
      ]);

      setItems(
        Array.isArray(inventoryData)
          ? inventoryData
          : inventoryData.data ?? []
      );

      setHistory(
        Array.isArray(historyData)
          ? historyData
          : historyData.data ?? []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load inventory. Check your API and backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleStockAction = async (action) => {
    const quantity = Number(form.quantity);

    if (!form.productId || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Select a product and enter a quantity greater than zero.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = {
        productId: form.productId,
        quantity,
        reason: form.reason,
      };

      if (action === "in") await stockIn(payload);
      if (action === "out") await stockOut(payload);
      if (action === "adjust") await adjustStock(payload);

      setForm({ productId: "", quantity: "", reason: "" });
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Stock update failed. Check your backend request format."
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Loading inventory...</p>;

  return (
    <main>
      <h1>Inventory Management</h1>

      {error && <p role="alert">{error}</p>}

      <h2>Current Stock</h2>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Unit</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id ?? item.productId}>
              <td>{item.name ?? item.productName}</td>
              <td>{item.quantity ?? item.stockQuantity}</td>
              <td>{item.unit ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Update Stock</h2>

      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Product
          <select
            name="productId"
            value={form.productId}
            onChange={handleChange}
            required
          >
            <option value="">Select product</option>
            {items.map((item) => (
              <option
                key={item.id ?? item.productId}
                value={item.id ?? item.productId}
              >
                {item.name ?? item.productName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantity
          <input
            name="quantity"
            type="number"
            min="0.001"
            step="any"
            value={form.quantity}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Reason
          <input
            name="reason"
            value={form.reason}
            onChange={handleChange}
            placeholder="Optional reason"
          />
        </label>

        <button disabled={busy} onClick={() => handleStockAction("in")}>
          Stock In
        </button>

        <button disabled={busy} onClick={() => handleStockAction("out")}>
          Stock Out
        </button>

        <button disabled={busy} onClick={() => handleStockAction("adjust")}>
          Adjust Stock
        </button>
      </form>

      <h2>Stock History</h2>

      <ul>
        {history.map((record, index) => (
          <li key={record.id ?? index}>
            {record.productName ?? record.name ?? "Stock movement"}
            {" — "}
            {record.quantity}
            {" — "}
            {record.reason ?? record.type ?? ""}
          </li>
        ))}
      </ul>
    </main>
  );
}

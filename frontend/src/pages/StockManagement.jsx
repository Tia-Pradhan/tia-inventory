
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Package,
  Plus,
  Minus,
  RefreshCw,
  Settings2,
  Search,
} from "lucide-react";

import { getProducts } from "../services/productApi";
import {
  getInventory,
  stockIn,
  stockOut,
  adjustStock,
} from "../services/inventoryApi";

import "../styles/stock.css";

const StockManagement = () => {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState("stock-in");

  const [form, setForm] = useState({
    productId: "",
    quantity: "",
    newQuantity: "",
    reason: "",
  });

  // Support API responses that return either an array
  // or an object containing a data array.
  const getArray = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [productsResponse, inventoryResponse] =
        await Promise.all([getProducts(), getInventory()]);

      setProducts(getArray(productsResponse));
      setInventory(getArray(inventoryResponse));
    } catch (err) {
      console.error("Failed to load stock data:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load products or inventory. Check the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Normalize different field names used by the API.
  const getProductId = (item) =>
    item.product_id ??
    item.productId ??
    item.product?.id ??
    item.product_id;

  const getProductForInventory = (item) =>
    item.product ||
    products.find(
      (product) =>
        String(product.id) === String(getProductId(item))
    ) ||
    {
      id: getProductId(item),
      name: item.productName ?? item.product_name ?? "Unknown product",
      sku: item.sku ?? "",
    };

  const getInventoryForProduct = (productId) =>
    inventory.find(
      (item) => String(getProductId(item)) === String(productId)
    );

  const selectedInventory = useMemo(() => {
    if (!form.productId) return null;
    return getInventoryForProduct(form.productId);
  }, [form.productId, inventory]);

  const currentStock = Number(selectedInventory?.quantity ?? 0);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleOperationChange = (value) => {
    setOperation(value);
    setForm({
      productId: "",
      quantity: "",
      newQuantity: "",
      reason: "",
    });
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    if (!form.productId) {
      setError("Please select a product.");
      return false;
    }

    if (operation === "adjustment") {
      if (
        form.newQuantity === "" ||
        !Number.isFinite(Number(form.newQuantity)) ||
        Number(form.newQuantity) < 0
      ) {
        setError("Enter a valid new stock quantity.");
        return false;
      }
    } else {
      if (
        form.quantity === "" ||
        !Number.isFinite(Number(form.quantity)) ||
        Number(form.quantity) <= 0
      ) {
        setError("Quantity must be greater than zero.");
        return false;
      }
    }

    if (!form.reason.trim()) {
      setError("Please enter a reason for this stock operation.");
      return false;
    }

    if (
      operation === "stock-out" &&
      Number(form.quantity) > currentStock
    ) {
      setError(
        `Stock out quantity cannot exceed current stock (${currentStock}).`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setOperationLoading(true);
      setError("");
      setSuccess("");

      // Send productId as expected by the existing frontend API service.
      const baseData = {
        productId: Number(form.productId),
        reason: form.reason.trim(),
      };

      if (operation === "stock-in") {
        await stockIn({
          ...baseData,
          quantity: Number(form.quantity),
        });
      } else if (operation === "stock-out") {
        await stockOut({
          ...baseData,
          quantity: Number(form.quantity),
        });
      } else {
        await adjustStock({
          ...baseData,
          newQuantity: Number(form.newQuantity),
        });
      }

      setSuccess("Stock operation completed successfully.");

      setForm({
        productId: "",
        quantity: "",
        newQuantity: "",
        reason: "",
      });

      await loadData();
    } catch (err) {
      console.error("Stock operation failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to complete the stock operation. Check the backend terminal."
      );
    } finally {
      setOperationLoading(false);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    const product = getProductForInventory(item);

    const searchableText =
      `${product.name || ""} ${product.sku || ""}`.toLowerCase();

    return searchableText.includes(search.toLowerCase().trim());
  });

  const getStatus = (item) => {
    const quantity = Number(item.quantity ?? 0);
    const reorderLevel = Number(
      item.reorder_level ??
        item.reorderLevel ??
        item.reorder_level ??
        0
    );

    if (quantity <= 0) return "Out of Stock";
    if (quantity <= reorderLevel) return "Low Stock";
    return "In Stock";
  };

  return (
    <div className="page stock-page">
      <div className="page-header">
        <div>
          <h1>Stock Management</h1>
          <p>Manage stock movements and inventory quantities</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="stock-operation-layout">
        <section className="stock-operation-card">
          <div className="stock-card-header">
            <div>
              <h2>Stock Operation</h2>
              <p>Add, remove or adjust inventory</p>
            </div>
            <Boxes size={24} />
          </div>

          <div className="operation-tabs">
            <button
              type="button"
              className={`operation-tab ${
                operation === "stock-in" ? "active" : ""
              }`}
              onClick={() => handleOperationChange("stock-in")}
            >
              <Plus size={17} /> Stock In
            </button>

            <button
              type="button"
              className={`operation-tab ${
                operation === "stock-out" ? "active" : ""
              }`}
              onClick={() => handleOperationChange("stock-out")}
            >
              <Minus size={17} /> Stock Out
            </button>

            <button
              type="button"
              className={`operation-tab ${
                operation === "adjustment" ? "active" : ""
              }`}
              onClick={() => handleOperationChange("adjustment")}
            >
              <Settings2 size={17} /> Adjustment
            </button>
          </div>

          <form className="stock-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="stock-product">Product *</label>
              <select
                id="stock-product"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                disabled={loading}
                required
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.sku ? ` — ${product.sku}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {form.productId && (
              <div className="current-stock-box">
                <Package size={20} />
                <div>
                  <span>Current Stock</span>
                  <strong>{currentStock}</strong>
                </div>
              </div>
            )}

            {operation === "adjustment" ? (
              <div className="form-group">
                <label htmlFor="newQuantity">
                  New Stock Quantity *
                </label>
                <input
                  id="newQuantity"
                  type="number"
                  name="newQuantity"
                  min="0"
                  step="any"
                  value={form.newQuantity}
                  onChange={handleChange}
                  placeholder="Enter new quantity"
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="quantity">Quantity *</label>
                <input
                  id="quantity"
                  type="number"
                  name="quantity"
                  min="0.001"
                  step="any"
                  value={form.quantity}
                  onChange={handleChange}
                  placeholder="Enter quantity"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reason">Reason *</label>
              <textarea
                id="reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={4}
                placeholder={
                  operation === "stock-in"
                    ? "e.g. New supplier delivery"
                    : operation === "stock-out"
                    ? "e.g. Damaged or expired stock"
                    : "e.g. Physical stock count correction"
                }
                required
              />
            </div>

            <button
              type="submit"
              className="primary-button stock-submit"
              disabled={operationLoading || loading}
            >
              {operationLoading
                ? "Processing..."
                : operation === "stock-in"
                ? "Add Stock"
                : operation === "stock-out"
                ? "Remove Stock"
                : "Adjust Stock"}
            </button>
          </form>
        </section>

        <aside className="stock-info-card">
          <h2>How it works</h2>

          <div className="operation-info">
            <div><Plus size={18} /></div>
            <div>
              <strong>Stock In</strong>
              <p>Increases the available quantity.</p>
            </div>
          </div>

          <div className="operation-info">
            <div><Minus size={18} /></div>
            <div>
              <strong>Stock Out</strong>
              <p>Decreases the available quantity.</p>
            </div>
          </div>

          <div className="operation-info">
            <div><Settings2 size={18} /></div>
            <div>
              <strong>Adjustment</strong>
              <p>Sets stock to a new verified quantity.</p>
            </div>
          </div>
        </aside>
      </div>

      <section className="inventory-section">
        <div className="inventory-section-header">
          <div>
            <h2>Current Inventory</h2>
            <p>Current stock levels from the inventory API</p>
          </div>

          <div className="inventory-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search inventory..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <RefreshCw size={30} className="spin" />
            <p>Loading inventory...</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="empty-state">
            <Boxes size={45} />
            <h3>No inventory found</h3>
            <p>Inventory records will appear here when available.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const product = getProductForInventory(item);
                  const status = getStatus(item);

                  return (
                    <tr key={item.id ?? getProductId(item)}>
                      <td><strong>{product.name || "-"}</strong></td>
                      <td>{product.sku || "-"}</td>
                      <td>{Number(item.quantity ?? 0)}</td>
                      <td>
                        {Number(
                          item.reorder_level ??
                            item.reorderLevel ??
                            0
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${status
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default StockManagement;

import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  UtensilsCrossed,
  RefreshCw,
  Package,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import {
  getMenuItems,
  getMenuAvailability,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../services/menuItemApi";


import "./MenuItems.css";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  is_available: true,
};

export default function MenuItems() {
  const [items, setItems] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [menuResponse, availabilityResponse] =
        await Promise.all([
          getMenuItems(),
          getMenuAvailability(),
        ]);

      const menuItems = Array.isArray(menuResponse)
        ? menuResponse
        : menuResponse?.data || [];

      const availabilityItems = Array.isArray(
        availabilityResponse
      )
        ? availabilityResponse
        : availabilityResponse?.data || [];

      setItems(menuItems);
      setAvailability(availabilityItems);
    } catch (err) {
      console.error("Menu loading error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load menu data. Check your backend and API routes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Match computed availability to each menu item.
  const availabilityById = new Map(
    availability.map((item) => [String(item.id), item])
  );

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);

    setForm({
      name: item.name || "",
      description: item.description || "",
      price: String(item.selling_price ?? item.price ?? ""),
      is_available:
        item.is_available === true ||
        Number(item.is_available) === 1,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Please enter a menu item name.");
      return;
    }

    if (
      form.price === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Please enter a valid price.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      selling_price: Number(form.price),
      is_available: form.is_available,
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        await updateMenuItem(editingId, payload);
        setSuccess("Menu item updated successfully.");
      } else {
        await createMenuItem(payload);
        setSuccess("Menu item added successfully.");
      }

      setShowForm(false);
      setForm({ ...emptyForm });
      setEditingId(null);

      await loadData();
    } catch (err) {
      console.error("Saving menu item error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to save menu item."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteMenuItem(item.id);
      setSuccess("Menu item deleted successfully.");
      await loadData();
    } catch (err) {
      console.error("Deleting menu item error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to delete menu item."
      );
    }
  };

  const filteredItems = items.filter((item) =>
    `${item.name || ""} ${item.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const getComputedStatus = (item) => {
    const calculated = availabilityById.get(String(item.id));

    // Never assume an item is stock-available when its
    // calculated availability data is missing.
    if (!calculated) {
      return {
        available: false,
        reasons: ["Availability data not loaded"],
        ingredients: [],
        hasData: false,
      };
    }

    return {
      available: calculated.available === true,
      reasons: calculated.reasons || [],
      ingredients: calculated.ingredients || [],
      hasData: true,
    };
  };

  const availableCount = items.filter(
    (item) => getComputedStatus(item).available
  ).length;

  const unavailableCount = items.length - availableCount;

  return (
    <div className="page menu-page">
      <div className="page-header menu-heading">
        <div>
          <h1>Menu Items</h1>
          <p>
            Manage restaurant dishes, prices, and ingredient-based
            availability.
          </p>
        </div>

        <div className="menu-heading-actions">
          <button
            type="button"
            className="menu-button menu-refresh"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="menu-button menu-primary"
            onClick={openAddForm}
          >
            <Plus size={18} />
            Add Menu Item
          </button>
        </div>
      </div>

      {error && (
        <div className="menu-alert menu-alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="menu-alert menu-alert-success">
          {success}
        </div>
      )}

      <div className="menu-summary">
        <div className="menu-summary-card">
          <span>Total Menu Items</span>
          <strong>{items.length}</strong>
        </div>

        <div className="menu-summary-card">
          <span>Available Items</span>
          <strong className="menu-count-good">
            {availableCount}
          </strong>
        </div>

        <div className="menu-summary-card">
          <span>Unavailable Items</span>
          <strong className="menu-count-bad">
            {unavailableCount}
          </strong>
        </div>
      </div>

      {showForm && (
        <div className="menu-form-card">
          <div className="menu-form-heading">
            <h2>
              {editingId !== null
                ? "Edit Menu Item"
                : "Add Menu Item"}
            </h2>

            <button
              type="button"
              className="menu-icon-button"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="menu-form-grid">
              <label>
                Item Name *
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Paneer Butter Masala"
                  required
                />
              </label>

              <label>
                Price (₹) *
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="200.00"
                  required
                />
              </label>

              <label className="menu-availability">
                <input
                  type="checkbox"
                  name="is_available"
                  checked={form.is_available}
                  onChange={handleChange}
                />
                Manually enabled for ordering
              </label>

              <label className="menu-description">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the dish..."
                  rows={3}
                />
              </label>
            </div>

            <div className="menu-form-actions">
              <button
                type="button"
                className="menu-button menu-refresh"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="menu-button menu-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Update Item"
                    : "Save Menu Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="menu-list-card">
        <div className="menu-list-heading">
          <div>
            <h2>All Menu Items</h2>
            <p>
              Availability is calculated using recipe ingredients
              and current stock.
            </p>
          </div>

          <div className="menu-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search menu items..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>
        </div>

        {loading ? (
          <div className="menu-empty">
            Loading menu availability...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="menu-empty">
            <UtensilsCrossed size={42} />
            <h3>No menu items found</h3>
            <p>Add a menu item or try a different search.</p>
          </div>
        ) : (
          <div className="menu-table-wrap">
            <table className="menu-table">
              <thead>
                <tr>
                  <th>Menu Item</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Stock Availability</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const status = getComputedStatus(item);
                  const itemPrice =
                    item.selling_price ?? item.price ?? 0;

                  const expanded = expandedId === item.id;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="menu-item-name">
                          <strong>{item.name}</strong>
                        </div>
                      </td>

                      <td>{item.description || "—"}</td>

                      <td>
                        ₹{Number(itemPrice).toFixed(2)}
                      </td>

                      <td>
                        <div className="menu-status-cell">
                          <span
                            className={`menu-status ${
                              status.available
                                ? "menu-status-available"
                                : "menu-status-unavailable"
                            }`}
                          >
                            {status.available ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <AlertTriangle size={14} />
                            )}
                            {status.available
                              ? "Available"
                              : "Unavailable"}
                          </span>

                          {status.reasons.length > 0 && (
                            <button
                              type="button"
                              className="menu-details-button"
                              onClick={() =>
                                setExpandedId(
                                  expanded ? null : item.id
                                )
                              }
                            >
                              {expanded
                                ? "Hide details"
                                : "View details"}
                            </button>
                          )}
                        </div>

                        {expanded && (
                          <div className="menu-availability-details">
                            {!status.hasData && (
                              <p>
                                Availability data is unavailable.
                                Try refreshing.
                              </p>
                            )}

                            {status.reasons.map((reason, index) => (
                              <p
                                className="menu-reason"
                                key={`${item.id}-reason-${index}`}
                              >
                                <AlertTriangle size={14} />
                                {reason}
                              </p>
                            ))}

                            {status.ingredients.length > 0 && (
                              <div className="menu-ingredient-list">
                                <strong>Ingredient stock</strong>

                                {status.ingredients.map(
                                  (ingredient) => (
                                    <div
                                      className="menu-ingredient-row"
                                      key={ingredient.ingredient_id}
                                    >
                                      <Package size={14} />

                                      <span>
                                        {ingredient.ingredient_name}
                                      </span>

                                      <span>
                                        Stock:{" "}
                                        {Number(
                                          ingredient.available_stock
                                        ).toFixed(2)}{" "}
                                        {ingredient.unit || ""}
                                      </span>

                                      <span>
                                        Required:{" "}
                                        {Number(
                                          ingredient.required_stock
                                        ).toFixed(2)}{" "}
                                        {ingredient.unit || ""}
                                      </span>

                                      <span
                                        className={
                                          ingredient.sufficient
                                            ? "menu-stock-good"
                                            : "menu-stock-bad"
                                        }
                                      >
                                        {ingredient.sufficient
                                          ? "Sufficient"
                                          : "Low stock"}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="menu-row-actions">
                          <button
                            type="button"
                            className="menu-icon-button"
                            title="Edit menu item"
                            onClick={() => openEditForm(item)}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            className="menu-icon-button menu-delete"
                            title="Delete menu item"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

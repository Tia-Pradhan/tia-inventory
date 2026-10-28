
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { getMenuAvailability } from "../services/availabilityApi";
import "../styles/sales.css";

const Sales = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [bill, setBill] = useState([]);

  // Customer management
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerError, setCustomerError] = useState("");

  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");

  // Load menu items
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/menu-items");
      const data = response.data;

      const items = Array.isArray(data)
        ? data
        : data.menuItems || data.items || [];

      setMenuItems(items);
    } catch (err) {
      console.error("Menu items API error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load menu items. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stock-based menu availability
  const loadAvailability = useCallback(async () => {
    try {
      const data = await getMenuAvailability();

      setAvailability(Array.isArray(data) ? data : []);
      setAvailabilityError("");
    } catch (err) {
      console.error("Menu availability API error:", err);
      setAvailabilityError(
        "Unable to check ingredient availability. Refresh or check the backend."
      );
    }
  }, []);

  // Load customers from MySQL through the backend API
  const loadCustomers = useCallback(async () => {
    try {
      setCustomerError("");

      const response = await api.get("/customers");
      const data = response.data;

      const customerList = Array.isArray(data)
        ? data
        : data.customers || [];

      setCustomers(customerList);
    } catch (err) {
      console.error("Load customers error:", err);
      setCustomerError(
        err.response?.data?.message ||
          "Unable to load customers. Check the customers API."
      );
    }
  }, []);

  useEffect(() => {
    loadData();
    loadAvailability();
    loadCustomers();
  }, [loadData, loadAvailability, loadCustomers]);

  // Find availability for a menu item
  const getAvailability = (itemId) =>
    availability.find(
      (entry) => Number(entry.id) === Number(itemId)
    );

  // Add an available item to the bill
  const addToBill = (item) => {
    setMessage("");
    setError("");

    const stockStatus = getAvailability(item.id);

    if (!stockStatus) {
      setError(
        "Availability is not confirmed for this item. Refresh and try again."
      );
      return;
    }

    if (!stockStatus.available) {
      setError(
        `${item.name} cannot be added: ${
          stockStatus.reasons?.join(", ") || "item is unavailable"
        }.`
      );
      return;
    }

    const id = Number(item.id);
    const price = Number(item.selling_price ?? item.price ?? 0);

    if (!id || !Number.isFinite(price) || price < 0) {
      setError("This menu item has invalid information.");
      return;
    }

    setBill((current) => {
      const existing = current.find((row) => row.id === id);

      if (existing) {
        return current.map((row) =>
          row.id === id
            ? { ...row, quantity: row.quantity + 1 }
            : row
        );
      }

      return [
        ...current,
        {
          id,
          name: item.name,
          price,
          quantity: 1,
        },
      ];
    });
  };

  // Change item quantity
  const changeQuantity = (id, amount) => {
    setMessage("");
    setError("");

    const item = menuItems.find(
      (menuItem) => Number(menuItem.id) === Number(id)
    );

    const status = item ? getAvailability(item.id) : null;

    if (amount > 0 && (!status || !status.available)) {
      setError(
        `${item?.name || "This item"} is no longer confirmed available.`
      );
      return;
    }

    setBill((current) =>
      current
        .map((row) =>
          row.id === id
            ? { ...row, quantity: row.quantity + amount }
            : row
        )
        .filter((row) => row.quantity > 0)
    );
  };

  // Remove an item from the bill
  const removeFromBill = (id) => {
    setBill((current) => current.filter((item) => item.id !== id));
    setMessage("");
    setError("");
  };

  // Calculate bill total
  const total = bill.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Complete sale
  const completeSale = async () => {
    if (bill.length === 0) {
      setError("Add at least one menu item to the bill.");
      return;
    }

    setCompleting(true);
    setError("");
    setMessage("");

    try {
      // Refresh availability immediately before submitting
      const latestAvailability = await getMenuAvailability();

      setAvailability(
        Array.isArray(latestAvailability) ? latestAvailability : []
      );

      const unavailableItems = bill.filter((billItem) => {
        const status = latestAvailability.find(
          (entry) => Number(entry.id) === Number(billItem.id)
        );

        return (
          !status ||
          !status.available ||
          billItem.quantity < 1
        );
      });

      if (unavailableItems.length > 0) {
        setError(
          `Please remove unavailable items: ${unavailableItems
            .map((item) => item.name)
            .join(", ")}.`
        );
        return;
      }

      // Submit the selected customer and bill to the backend.
      // The backend must save customer_id and deduct stock
      // within its existing database transaction.
      const response = await api.post("/sales", {
        customer_id: selectedCustomerId
          ? Number(selectedCustomerId)
          : null,

        items: bill.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
        })),
      });

      setMessage(
        response.data?.message || "Sale completed successfully."
      );

      setBill([]);
      setSelectedCustomerId("");

      await Promise.all([
        loadData(),
        loadAvailability(),
        loadCustomers(),
      ]);
    } catch (err) {
      console.error("Complete sale error:", err);

      setError(
        err.response?.data?.message ||
          "Sale failed. Check your sales API and ingredient stock."
      );

      // Stock may have changed after another sale
      await loadAvailability();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Sales / Billing</h1>
          <p className="sales-subtitle">
            Select available menu items to create a bill.
          </p>
        </div>

        <button
          type="button"
          className="sales-refresh-btn"
          onClick={() =>
            Promise.all([
              loadData(),
              loadAvailability(),
              loadCustomers(),
            ])
          }
          disabled={loading || completing}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {message && (
        <div className="sales-message" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="sales-message sales-error" role="alert">
          {error}
        </div>
      )}

      {availabilityError && (
        <div className="sales-message sales-error" role="alert">
          {availabilityError}
        </div>
      )}

      {/* Customer selection */}
      <section className="sales-customer-section">
        <div className="sales-customer-heading">
          <div>
            <h2>Customer Details</h2>
            <p>Select an existing customer or bill as a walk-in customer.</p>
          </div>

          <button
            type="button"
            className="sales-customer-refresh"
            onClick={loadCustomers}
            disabled={completing}
          >
            Refresh Customers
          </button>
        </div>

        <label htmlFor="sales-customer">
          Select Customer
        </label>

        <select
          id="sales-customer"
          value={selectedCustomerId}
          onChange={(event) =>
            setSelectedCustomerId(event.target.value)
          }
          disabled={completing}
        >
          <option value="">Walk-in Customer</option>

          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} — {customer.phone}
            </option>
          ))}
        </select>

        {customerError && (
          <p className="sales-customer-error" role="alert">
            {customerError}
          </p>
        )}

        {!customerError && customers.length === 0 && (
          <p className="sales-customer-hint">
            No registered customers found. You can still create a
            walk-in sale.
          </p>
        )}

        {selectedCustomerId && (
          <div className="sales-selected-customer">
            <strong>Selected:</strong>{" "}
            {customers.find(
              (customer) =>
                Number(customer.id) === Number(selectedCustomerId)
            )?.name || "Customer"}
          </div>
        )}
      </section>

      <h2>Menu Items &amp; Availability</h2>

      {loading && menuItems.length === 0 ? (
        <p>Loading menu items...</p>
      ) : menuItems.length === 0 ? (
        <p>No menu items found. Add menu items first.</p>
      ) : (
        <div className="sales-menu-grid">
          {menuItems.map((item) => {
            const status = getAvailability(item.id);
            const confirmedAvailable = status?.available === true;
            const price = Number(
              item.selling_price ?? item.price ?? 0
            );

            return (
              <div className="sales-menu-card" key={item.id}>
                <h3>{item.name}</h3>

                <p className="sales-price">
                  ₹{price.toFixed(2)}
                </p>

                <p
                  className={
                    confirmedAvailable
                      ? "sales-availability available"
                      : "sales-availability unavailable"
                  }
                >
                  {!status
                    ? "Checking availability..."
                    : confirmedAvailable
                    ? "Available"
                    : "Unavailable"}
                </p>

                {status?.reasons?.length > 0 && (
                  <p className="sales-availability-reason">
                    {status.reasons.join(", ")}
                  </p>
                )}

                <button
                  type="button"
                  className="sales-add-btn"
                  onClick={() => addToBill(item)}
                  disabled={
                    !confirmedAvailable ||
                    loading ||
                    completing ||
                    Boolean(availabilityError)
                  }
                  title={
                    confirmedAvailable
                      ? "Add to bill"
                      : "This item is unavailable or availability has not been confirmed"
                  }
                >
                  {confirmedAvailable
                    ? "+ Add to Bill"
                    : "Unavailable"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Current bill */}
      <h2>Current Bill</h2>

      <div className="sales-table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Subtotal</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {bill.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
                  Your bill is empty. Add an available menu item above.
                </td>
              </tr>
            ) : (
              bill.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>

                  <td>₹{item.price.toFixed(2)}</td>

                  <td>
                    <div className="sales-quantity">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() =>
                          changeQuantity(item.id, -1)
                        }
                        disabled={completing}
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() =>
                          changeQuantity(item.id, 1)
                        }
                        disabled={completing}
                      >
                        +
                      </button>
                    </div>
                  </td>

                  <td>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="sales-remove-btn"
                      onClick={() => removeFromBill(item.id)}
                      disabled={completing}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="sales-total">
        Total: ₹{total.toFixed(2)}
      </div>

      <button
        type="button"
        className="sales-complete-btn"
        onClick={completeSale}
        disabled={
          completing ||
          bill.length === 0 ||
          Boolean(availabilityError)
        }
      >
        {completing ? "Processing Sale..." : "Complete Sale"}
      </button>
    </div>
  );
};

export default Sales;


import { useCallback, useEffect, useState } from "react";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../services/customerApi";
import "../styles/customers.css";

const emptyForm = {
  name: "",
  phone: "",
  address: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getCustomers(search);
      setCustomers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load customers."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();

    if (!name || !phone) {
      setError("Customer name and phone are required.");
      return;
    }

    setSaving(true);

    try {
      const customer = { name, phone, address };

      if (editingId !== null) {
        const response = await updateCustomer(editingId, customer);
        setMessage(
          response.data?.message || "Customer updated successfully."
        );
      } else {
        const response = await createCustomer(customer);
        setMessage(
          response.data?.message || "Customer added successfully."
        );
      }

      resetForm();
      await loadCustomers();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save customer."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (customer) => {
    const confirmed = window.confirm(
      `Delete customer "${customer.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await deleteCustomer(customer.id);
      setMessage(
        response.data?.message || "Customer deleted successfully."
      );

      if (editingId === customer.id) resetForm();

      await loadCustomers();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete customer."
      );
    }
  };

  return (
    <div className="customers-page">
      <header className="customers-header">
        <div>
          <h1>Customer Management</h1>
          <p>Manage your restaurant customers and their contact details.</p>
        </div>

        <button
          type="button"
          className="customer-btn customer-btn-light"
          onClick={loadCustomers}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </header>

      {message && (
        <div className="customer-alert customer-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="customer-alert customer-error" role="alert">
          {error}
        </div>
      )}

      <section className="customer-panel">
        <h2>{editingId !== null ? "Edit Customer" : "Add Customer"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="customer-form-grid">
            <label className="customer-field">
              Customer Name *
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter full name"
                maxLength={150}
                required
              />
            </label>

            <label className="customer-field">
              Phone Number *
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. +91 9876543210"
                maxLength={20}
                required
              />
            </label>

            <label className="customer-field customer-address-field">
              Address
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Enter customer address"
                rows={3}
              />
            </label>
          </div>

          <div className="customer-actions">
            <button
              type="submit"
              className="customer-btn customer-btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                ? "Update Customer"
                : "Add Customer"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="customer-btn customer-btn-light"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="customer-panel">
        <div className="customer-list-header">
          <div>
            <h2>Customers</h2>
            <p>{customers.length} customer(s) displayed</p>
          </div>

          <label className="customer-search">
            <span className="sr-only">Search customers</span>
            <input
              type="search"
              placeholder="Search name or phone..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p className="customer-empty">Loading customers...</p>
        ) : customers.length === 0 ? (
          <p className="customer-empty">
            No customers found. Add your first customer above.
          </p>
        ) : (
          <div className="customer-table-wrap">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td data-label="Name">{customer.name}</td>
                    <td data-label="Phone">{customer.phone}</td>
                    <td data-label="Address">
                      {customer.address || "—"}
                    </td>
                    <td data-label="Actions">
                      <div className="customer-row-actions">
                        <button
                          type="button"
                          className="customer-btn customer-btn-edit"
                          onClick={() => handleEdit(customer)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="customer-btn customer-btn-delete"
                          onClick={() => handleDelete(customer)}
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createProduct, updateProduct } from "../services/productApi";
import { getCategories } from "../services/CategoryApi";

const initialForm = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  costPrice: "",
  sellingPrice: "",
  gstRate: "",
  quantity: "",
  reorderLevel: "",
};

const ProductForm = ({ product = null }) => {
  const navigate = useNavigate();

  const isEditMode = Boolean(product);

  const [form, setForm] = useState(initialForm);

  const [categories, setCategories] = useState([]);

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);

        const response = await getCategories();

        const data = Array.isArray(response)
          ? response
          : response?.data || [];

        setCategories(data);
      } catch (error) {
        console.error(error);

        setError(
          "Unable to load categories. Please check the backend connection."
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    if (!product) {
      setForm(initialForm);
      return;
    }

    setForm({
      name: product.name || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      categoryId:
        product.categoryId ||
        product.category?.id ||
        "",
      costPrice:
        product.costPrice ?? "",
      sellingPrice:
        product.sellingPrice ?? "",
      gstRate:
        product.gstRate ?? "",
      quantity:
        product.inventory?.quantity ??
        product.quantity ??
        "",
      reorderLevel:
        product.inventory?.reorderLevel ??
        product.reorderLevel ??
        "",
    });
  }, [product]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  const validate = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Product name is required.";
    }

    if (!form.sku.trim()) {
      errors.sku = "SKU is required.";
    }

    if (
      form.costPrice === "" ||
      Number(form.costPrice) < 0
    ) {
      errors.costPrice =
        "Enter a valid cost price.";
    }

    if (
      form.sellingPrice === "" ||
      Number(form.sellingPrice) < 0
    ) {
      errors.sellingPrice =
        "Enter a valid selling price.";
    }

    if (
      form.gstRate !== "" &&
      (Number(form.gstRate) < 0 ||
        Number(form.gstRate) > 100)
    ) {
      errors.gstRate =
        "GST rate must be between 0 and 100.";
    }

    if (
      form.quantity !== "" &&
      Number(form.quantity) < 0
    ) {
      errors.quantity =
        "Quantity cannot be negative.";
    }

    if (
      form.reorderLevel !== "" &&
      Number(form.reorderLevel) < 0
    ) {
      errors.reorderLevel =
        "Reorder level cannot be negative.";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const productData = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,

      categoryId:
        form.categoryId || null,

      costPrice: Number(form.costPrice),

      sellingPrice:
        Number(form.sellingPrice),

      gstRate:
        form.gstRate === ""
          ? 0
          : Number(form.gstRate),

      quantity:
        form.quantity === ""
          ? 0
          : Number(form.quantity),

      reorderLevel:
        form.reorderLevel === ""
          ? 0
          : Number(form.reorderLevel),
    };

    try {
      setSaving(true);
      setError("");

      if (isEditMode) {
        await updateProduct(
          product.id,
          productData
        );
      } else {
        await createProduct(productData);
      }

      navigate("/products");
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.message ||
          `Unable to ${
            isEditMode
              ? "update"
              : "create"
          } product.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="product-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <div className="form-section">
        <h2>Basic Information</h2>

        <div className="form-grid">
          <div className="form-group">
            <label>
              Product Name *
            </label>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter product name"
            />

            {fieldErrors.name && (
              <span className="field-error">
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>SKU *</label>

            <input
              type="text"
              name="sku"
              value={form.sku}
              onChange={handleChange}
              placeholder="Enter SKU"
            />

            {fieldErrors.sku && (
              <span className="field-error">
                {fieldErrors.sku}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Barcode</label>

            <input
              type="text"
              name="barcode"
              value={form.barcode}
              onChange={handleChange}
              placeholder="Enter barcode"
            />
          </div>

          <div className="form-group">
            <label>Category</label>

            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              disabled={loadingCategories}
            >
              <option value="">
                {loadingCategories
                  ? "Loading categories..."
                  : "Select category"}
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Pricing & Tax</h2>

        <div className="form-grid">
          <div className="form-group">
            <label>
              Cost Price *
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              name="costPrice"
              value={form.costPrice}
              onChange={handleChange}
              placeholder="0.00"
            />

            {fieldErrors.costPrice && (
              <span className="field-error">
                {fieldErrors.costPrice}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>
              Selling Price *
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              name="sellingPrice"
              value={form.sellingPrice}
              onChange={handleChange}
              placeholder="0.00"
            />

            {fieldErrors.sellingPrice && (
              <span className="field-error">
                {fieldErrors.sellingPrice}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>GST Rate (%)</label>

            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              name="gstRate"
              value={form.gstRate}
              onChange={handleChange}
              placeholder="0"
            />

            {fieldErrors.gstRate && (
              <span className="field-error">
                {fieldErrors.gstRate}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Inventory</h2>

        <div className="form-grid">
          <div className="form-group">
            <label>
              {isEditMode
                ? "Current Quantity"
                : "Initial Quantity"}
            </label>

            <input
              type="number"
              min="0"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              placeholder="0"
            />

            {fieldErrors.quantity && (
              <span className="field-error">
                {fieldErrors.quantity}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>
              Reorder Level
            </label>

            <input
              type="number"
              min="0"
              name="reorderLevel"
              value={form.reorderLevel}
              onChange={handleChange}
              placeholder="0"
            />

            {fieldErrors.reorderLevel && (
              <span className="field-error">
                {fieldErrors.reorderLevel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            navigate("/products")
          }
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="primary-button"
          disabled={saving}
        >
          {saving
            ? isEditMode
              ? "Updating..."
              : "Saving..."
            : isEditMode
            ? "Update Product"
            : "Save Product"}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
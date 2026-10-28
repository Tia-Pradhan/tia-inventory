import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createCategory,
  updateCategory,
} from "../services/CategoryApi";

const CategoryForm = ({
  category = null,
}) => {
  const navigate = useNavigate();

  const isEditMode =
    Boolean(category);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [fieldError, setFieldError] =
    useState("");

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name || "",
        description:
          category.description || "",
      });
    }
  }, [category]);

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (name === "name") {
      setFieldError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name =
      form.name.trim();

    if (!name) {
      setFieldError(
        "Category name is required."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const categoryData = {
        name,
        description:
          form.description.trim() ||
          null,
      };

      if (isEditMode) {
        await updateCategory(
          category.id,
          categoryData
        );
      } else {
        await createCategory(
          categoryData
        );
      }

      navigate("/categories");
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data
          ?.message ||
          `Unable to ${
            isEditMode
              ? "update"
              : "create"
          } category.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="category-form"
      onSubmit={handleSubmit}
    >
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <div className="form-group">
        <label>
          Category Name *
        </label>

        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Enter category name"
          maxLength={100}
        />

        {fieldError && (
          <span className="field-error">
            {fieldError}
          </span>
        )}
      </div>

      <div className="form-group">
        <label>
          Description
        </label>

        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Enter category description"
          rows="5"
          maxLength={500}
        />

        <span className="character-count">
          {form.description.length}/500
        </span>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={saving}
          onClick={() =>
            navigate("/categories")
          }
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
            ? "Update Category"
            : "Save Category"}
        </button>
      </div>
    </form>
  );
};

export default CategoryForm;
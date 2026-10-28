import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import CategoryForm from "../components/CategoryForm";

import {
  getCategory,
} from "../services/CategoryApi";

const EditCategory = () => {
  const { id } = useParams();

  const navigate = useNavigate();

  const [category, setCategory] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadCategory = async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await getCategory(id);

        const data =
          response?.data ||
          response;

        setCategory(data);
      } catch (error) {
        console.error(error);

        setError(
          "Unable to load category."
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadCategory();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">
          Loading category...
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="page">
        <div className="error-message">
          {error ||
            "Category not found."}
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            navigate("/categories")
          }
        >
          Back to Categories
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Edit Category</h1>

          <p>
            Update category information
          </p>
        </div>
      </div>

      <CategoryForm
        category={category}
      />
    </div>
  );
};

export default EditCategory;
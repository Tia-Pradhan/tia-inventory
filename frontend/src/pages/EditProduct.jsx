import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ProductForm from "../components/ProductForm";
import { getProduct } from "../services/productApi";

const EditProduct = () => {
  const { id } = useParams();

  const navigate = useNavigate();

  const [product, setProduct] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await getProduct(id);

        const data =
          response?.data || response;

        setProduct(data);
      } catch (error) {
        console.error(error);

        setError(
          "Unable to load product."
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadProduct();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">
          Loading product...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page">
        <div className="error-message">
          {error || "Product not found."}
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            navigate("/products")
          }
        >
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Edit Product</h1>

          <p>
            Update product information
          </p>
        </div>
      </div>

      <ProductForm product={product} />
    </div>
  );
};

export default EditProduct;

import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Sidebar from "./components/sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";

import Categories from "./pages/Categories";
import AddCategory from "./pages/AddCategory";
import EditCategory from "./pages/EditCategory";

import StockManagement from "./pages/StockManagement";
import StockHistory from "./pages/StockHistory";
import MenuItems from "./pages/menuItems";
import Recipes from "./pages/Recipes";
import Sales from "./pages/Sales";
import ConsumptionHistory from "./pages/ConsumptionHistory";
import Wastage from "./pages/Wastage";
import StockConsumption from "./pages/StockConsumption";
import MenuAvailability from "./pages/MenuAvailability";
import Customers from "./pages/Customer";
import Reservations from "./pages/Reservations";
import Notifications from "./pages/Notifications";
import Analytics from "./pages/Analytics";

// NEW: Ingredients page
import Ingredients from "./pages/Ingredients";

import "./styles/global.css";
import "./styles/layout.css";
import "./styles/dashboard.css";
import "./styles/products.css";
import "./styles/categories.css";
import "./styles/stock.css";
import "./styles/history.css";

const App = () => {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />

        <div className="main-area">
          <Header />

          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* Products */}
              <Route path="/products" element={<Products />} />
              <Route path="/products/add" element={<AddProduct />} />
              <Route
                path="/products/edit/:id"
                element={<EditProduct />}
              />

              {/* Categories */}
              <Route path="/categories" element={<Categories />} />
              <Route
                path="/categories/add"
                element={<AddCategory />}
              />
              <Route
                path="/categories/edit/:id"
                element={<EditCategory />}
              />

              {/* Inventory */}
              <Route path="/stock" element={<StockManagement />} />
              <Route path="/stock-history" element={<StockHistory />} />

              {/* NEW: Ingredient management */}
              <Route
                path="/ingredients"
                element={<Ingredients />}
              />

              {/* Menu items and recipes */}
              <Route path="/menu-items" element={<MenuItems />} />
              <Route path="/recipes" element={<Recipes />} />

              {/* Sales and stock operations */}
              <Route path="/sales" element={<Sales />} />
              <Route
                path="/consumption-history"
                element={<ConsumptionHistory />}
              />
              <Route path="/wastage" element={<Wastage />} />
              <Route
                path="/consumption"
                element={<StockConsumption />}
              />
              <Route
                path="/menu-availability"
                element={<MenuAvailability />}
              />
              
             <Route path="/customers" 
             element={<Customers />} />

             <Route path="/reservations" 
             element={<Reservations />} />
             <Route
  path="/notifications"
  element={<Notifications />}

/>
<Route path="/analytics" element={<Analytics />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;

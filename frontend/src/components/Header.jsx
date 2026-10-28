
import { Search, UserCircle } from "lucide-react";
import NotificationBell from "../pages/NotificationBell";

const Header = () => {
  return (
    <header className="header">
      <div className="header-search">
        <Search size={19} />

        <input
          type="text"
          placeholder="Search..."
        />
      </div>

      <div className="header-right">
        {/* Working notification bell with badge and dropdown */}
        <NotificationBell />

        <div className="user-info">
          <UserCircle size={34} />

          <div>
            <strong>Admin</strong>
            <span>Inventory Manager</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

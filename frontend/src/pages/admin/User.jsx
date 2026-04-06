import { useEffect, useState } from "react";
import FilterDrawer from "../../components/common/FilterDrawer";
import UserTable from "../../components/users/UserTable";
import { fetchUsers } from "../../services/userService";

export default function Users() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({});

  // Fetch users
  const loadUsers = async (appliedFilters = {}) => {
    try {
      const data = await fetchUsers(appliedFilters);
      setUsers(data);
    } catch (err) {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Apply filters
  const handleApply = (data) => {
    setFilters(data);
    loadUsers(data);
    setOpen(false);
  };

  // Reset filters
  const handleReset = () => {
    setFilters({});
    loadUsers({});
  };

  return (
    <div className="p-6">
      {/* Top Bar */}
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-semibold">Users</h1>

        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-md border border-[#2A2623] bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] text-[#1A1816] shadow-[0_12px_30px_rgba(166,124,82,0.4)] transition hover:shadow-[0_16px_36px_rgba(166,124,82,0.4)]"
        >
          Filter
        </button>
      </div>

      {/* Table */}
      <UserTable
        users={users}
        onEdit={() => {}}
        onDelete={() => {}}
      />

      {/* Drawer */}
      <FilterDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        filters={[
          {
            key: "department",
            label: "Department",
            type: "select",
            options: ["HR", "IT"], // later API se laa sakte ho
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: ["Active", "Pending", "Disabled"],
          },
          {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search user...",
          },
        ]}
        onApply={handleApply}
        onReset={handleReset}
      />
    </div>
  );
}

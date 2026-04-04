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
      console.error("Error fetching users", err);
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
          className="px-4 py-2 rounded-md text-white bg-gradient-to-r from-indigo-500 to-purple-500"
        >
          Filter
        </button>
      </div>

      {/* Table */}
      <UserTable
        users={users}
        onEdit={(u) => console.log("Edit:", u)}
        onDelete={(id) => console.log("Delete:", id)}
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
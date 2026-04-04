import { Pencil, Trash2 } from "lucide-react";
import StatusBadge from "../common/StatusBadge";

export default function UserTable({ users, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-4 text-left">Name</th>
            <th>Email</th>
            <th>Status</th>
            <th className="text-right pr-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-t hover:bg-gray-50 transition"
            >
              <td className="p-4">{user.name}</td>
              <td>{user.email}</td>
              <td>
                <StatusBadge status={user.status} />
              </td>

              <td className="text-right pr-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="p-2 rounded hover:bg-gray-100"
                    title="Edit User"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => onDelete(user.id)}
                    className="rounded bg-red-600 p-2 text-white hover:bg-red-700"
                    title="Delete User"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
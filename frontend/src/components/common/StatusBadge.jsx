export default function StatusBadge({ status }) {
  const styles = {
    Active: "bg-green-100 text-green-600",
    Pending: "bg-yellow-100 text-yellow-600",
    Disabled: "bg-red-100 text-red-600",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}
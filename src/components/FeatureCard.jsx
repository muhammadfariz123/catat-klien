export default function FeatureCard({
  title,
  value,
  icon,
  color = "blue",
  active = false,
  onClick,
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    yellow: "bg-yellow-50 text-yellow-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl p-5 flex justify-between items-center shadow-sm transition
        ${active ? colors[color] : "bg-white text-gray-500 hover:bg-gray-50"}
      `}
    >
      <div>
        <p className="text-sm">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>

      <div
        className={`p-3 rounded-xl ${
          active ? "bg-white" : "bg-gray-100"
        }`}
      >
        {icon}
      </div>
    </div>
  );
}

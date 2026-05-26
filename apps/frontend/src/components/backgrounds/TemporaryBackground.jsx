// TemporaryBackground.jsx
export default function TemporaryBackground() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black z-0">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent"></div>
    </div>
  );
}
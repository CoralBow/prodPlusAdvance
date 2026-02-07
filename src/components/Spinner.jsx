export default function Spinner({ size = 24 }) {
  return (
    <div
      className="border-4 border-current border-t-transparent rounded-full animate-spin opacity-80"
      style={{ width: size, height: size }}
    />
  );
}

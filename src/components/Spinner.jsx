export default function Spinner({ size = 6 }) {
  return (
    <div
      className={`w-${size} h-${size} border-4 border-current border-t-transparent rounded-full animate-spin opacity-80`}
    />
  );
}

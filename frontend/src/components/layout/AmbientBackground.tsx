export function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-transparent">
      <div className="ambient-light-1" />
      <div className="ambient-light-2" />
      <div className="ambient-light-3" />
    </div>
  );
}

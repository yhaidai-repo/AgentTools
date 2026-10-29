// Shown in place of a page while the server builds it, so a click on the menu answers at once.
export default function Loading() {
  return (
    <div className="page-loading" aria-hidden="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-panel" />
      <div className="skeleton skeleton-panel" />
    </div>
  );
}

export function DashboardBrand(): JSX.Element {
  return (
    <div className="brand-group">
      <img className="product-logo" src="/logo/phpsage-logo.png" alt="PHPSage" />
      <div>
        <h1 className="brand-title">Dashboard</h1>
        <p className="brand-subtitle">PHPStan Pro-like run monitoring</p>
        <div className="view-tabs" aria-hidden="true">
          <span className="view-tab view-tab-active">Dashboard</span>
          <span className="view-tab">Insights</span>
          <span className="view-tab">Issue</span>
        </div>
      </div>
    </div>
  );
}
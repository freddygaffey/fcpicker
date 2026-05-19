import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const loc = useLocation();
  const onSelector = loc.pathname === "/";

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <svg
              className="brand-icon"
              width="28"
              height="28"
              viewBox="0 0 32 32"
              aria-hidden="true"
            >
              <circle cx="16" cy="16" r="14" fill="none" stroke="#88c249" strokeWidth="2" />
              <path
                d="M16 4 L19 14 L29 16 L19 18 L16 28 L13 18 L3 16 L13 14 Z"
                fill="#27aae1"
              />
            </svg>
            <span className="brand-text">
              fc<span className="brand-text-accent">Picker</span>
            </span>
          </Link>
          <nav className="site-nav">
            <Link to="/">Board selector</Link>
            <a href="https://ardupilot.org/copter/docs/common-autopilots.html" target="_blank" rel="noreferrer">
              ArduPilot docs ↗
            </a>
            <a href="https://github.com/ArduPilot/ardupilot" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      <main className={onSelector ? "stage stage-selector" : "stage stage-detail"}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="footer-line">
            fcPicker is an independent project and is not affiliated with ArduPilot.
            Board data is parsed from{" "}
            <a
              href="https://github.com/ArduPilot/ardupilot/tree/master/libraries/AP_HAL_ChibiOS/hwdef"
              target="_blank"
              rel="noreferrer"
            >
              ArduPilot&rsquo;s hardware-definition files
            </a>{" "}
            — always verify specifications against the{" "}
            <a href="https://ardupilot.org" target="_blank" rel="noreferrer">
              official ArduPilot documentation
            </a>{" "}
            before purchasing hardware.
          </p>
        </div>
      </footer>
    </div>
  );
}

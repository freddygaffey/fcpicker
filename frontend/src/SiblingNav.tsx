import { Link, useLocation } from "react-router-dom";

interface SiblingNavState {
  siblings?: string[];
  filterLabel?: string;
}

interface Props {
  /** Current item's ID as it appears in the siblings list. */
  currentId: string;
  /** Fallback ordered list, used when navigation state is missing
   *  (e.g. the user landed directly on this URL). */
  fallbackIds: string[];
  /** Build a navigation URL from an item ID. */
  toUrl: (id: string) => string;
  /** Short noun for the prev/next buttons, e.g. "board", "device". */
  itemNoun: string;
}

export function SiblingNav({ currentId, fallbackIds, toUrl, itemNoun }: Props) {
  const loc = useLocation();
  const state = (loc.state ?? null) as SiblingNavState | null;
  const fromFilter = state?.siblings && state.siblings.length > 0;
  const list = fromFilter ? state!.siblings! : fallbackIds;

  const idx = list.indexOf(currentId);
  // If the current item isn't in the list (e.g. filter changed after navigation),
  // we can't compute prev/next; render nothing.
  if (idx < 0) return null;

  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx < list.length - 1 ? list[idx + 1] : null;

  // Re-forward navigation state so prev/next keep working as you walk the list.
  const forwardState: SiblingNavState | undefined = fromFilter
    ? { siblings: state!.siblings, filterLabel: state?.filterLabel }
    : undefined;

  return (
    <nav className="sibling-nav" aria-label={`Adjacent ${itemNoun}s`}>
      {prev ? (
        <Link to={toUrl(prev)} state={forwardState} className="sibling-nav-btn">
          <span className="sibling-nav-arrow" aria-hidden="true">‹</span>
          <span>Previous {itemNoun}</span>
        </Link>
      ) : (
        <span className="sibling-nav-btn sibling-nav-disabled">
          <span className="sibling-nav-arrow" aria-hidden="true">‹</span>
          <span>Previous {itemNoun}</span>
        </span>
      )}
      <span className="sibling-nav-pos">
        {idx + 1} of {list.length}
        {fromFilter && <span className="sibling-nav-filter"> · filtered</span>}
      </span>
      {next ? (
        <Link to={toUrl(next)} state={forwardState} className="sibling-nav-btn">
          <span>Next {itemNoun}</span>
          <span className="sibling-nav-arrow" aria-hidden="true">›</span>
        </Link>
      ) : (
        <span className="sibling-nav-btn sibling-nav-disabled">
          <span>Next {itemNoun}</span>
          <span className="sibling-nav-arrow" aria-hidden="true">›</span>
        </span>
      )}
    </nav>
  );
}

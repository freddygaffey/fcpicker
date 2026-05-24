const REPO = "freddygaffey/fcpicker";

/**
 * A zero-backend "flag incorrect information" link. Opens a prefilled GitHub
 * issue against this repo — no auth, no Function, no token. The maintainer
 * triages the issue and edits the relevant data/<category>/<slug>.json by hand.
 */
export function ReportIssue({
  category,
  itemId,
  label,
}: {
  category: string; // human category, e.g. "Flight controller"
  itemId: string; // identifier matching the data file, e.g. slug or kind-slug
  label: string; // display name shown to the user
}) {
  const title = `Incorrect info: ${label}`;
  const body = [
    `**Item:** ${category} — \`${itemId}\``,
    `**Page:** ${typeof window !== "undefined" ? window.location.href : ""}`,
    "",
    "**What is wrong?**",
    "",
    "**Correct value (if known):**",
    "",
    "**Source (datasheet / vendor page / wiki link):**",
    "",
  ].join("\n");
  const href =
    `https://github.com/${REPO}/issues/new` +
    `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

  return (
    <p className="report-issue">
      Spotted a mistake?{" "}
      <a href={href} target="_blank" rel="noreferrer">
        Report incorrect information ↗
      </a>
    </p>
  );
}

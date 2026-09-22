"use client";
// src/app/print/inventory/PrintControls.tsx

/** Screen-only toolbar; hidden by the print stylesheet. */
export function PrintControls() {
  return (
    <div className="print-controls">
      <button onClick={() => window.print()}>🖨 Print / Save as PDF</button>
      <button onClick={() => window.close()} className="secondary">
        Close
      </button>
      <span>
        Choose “Save as PDF” as the destination in the print dialog to get a
        file.
      </span>
    </div>
  );
}

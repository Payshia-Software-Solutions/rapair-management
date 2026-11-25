"use client";

import { useEffect } from "react";

/** Old address: the balance sheet now prints from the financial statements print page. */
export default function BalanceSheetPrintRedirect() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const asOf = p.get("asOf") || p.get("as_of") || new Date().toISOString().slice(0, 10);
    window.location.replace(`/accounting/statements/print?tab=bs&as_of=${asOf}&level=3`);
  }, []);
  return null;
}

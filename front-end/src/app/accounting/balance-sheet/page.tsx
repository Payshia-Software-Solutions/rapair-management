import { redirect } from "next/navigation";

// Replaced by the combined statements page.
export default function OldBalanceSheetRoute() {
  redirect("/accounting/statements?tab=bs");
}

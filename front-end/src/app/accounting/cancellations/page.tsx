import { redirect } from "next/navigation";

// Moved to the core Approvals & Control group.
export default function OldCancellationsRoute() {
  redirect("/approvals/request-cancellation");
}

const MESSAGES: Record<string, { title: string; text: string }> = {
  workspace_not_found: {
    title: "Workspace not found",
    text: "There is no workspace at this address. Check the link, or ask your administrator for the correct one.",
  },
  workspace_suspended: {
    title: "Workspace paused",
    text: "This workspace is paused. Please contact your administrator about the subscription.",
  },
  workspace_not_ready: {
    title: "Workspace is being set up",
    text: "This workspace is still being prepared. Please try again in a few minutes.",
  },
};

export default async function WorkspaceUnavailable({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code = "" } = await searchParams;
  const m = MESSAGES[code] ?? {
    title: "Workspace unavailable",
    text: "This workspace cannot be opened right now. Please try again later.",
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="mt-3 text-muted-foreground">{m.text}</p>
      </div>
    </main>
  );
}

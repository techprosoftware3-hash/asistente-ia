import Chat from "@/components/Chat";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const employeeId = resolvedParams.id;

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 p-4 flex flex-col transition-colors duration-200">
      <div className="mx-auto max-w-4xl w-full flex flex-col h-full">
        <div className="mb-2 shrink-0">
          <a
            href="/dashboard"
            className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← Volver al dashboard
          </a>
        </div>
        <div className="flex-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col transition-colors duration-200">
          <Chat employeeId={employeeId} />
        </div>
      </div>
    </div>
  );
}
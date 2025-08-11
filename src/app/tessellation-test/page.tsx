import Link from "next/link";
import TestTessellation from "../../components/TestTessellation";
import CompactLoggingControls from "../../components/CompactLoggingControls";

export default function TessellationTestPage() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="bg-white border-b px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Tessellation Testing</h1>
          <CompactLoggingControls />
        </div>
        <div className="flex gap-2">
          <Link
            href="/cutting-test"
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Cutting Test
          </Link>
          <Link
            href="/"
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            ← Back to Main
          </Link>
        </div>
      </header>
      <div className="flex-1">
        <TestTessellation />
      </div>
    </div>
  );
}

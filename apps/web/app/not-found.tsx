import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="text-center">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2">404</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

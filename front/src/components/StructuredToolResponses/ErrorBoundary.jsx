export default function ErrorBoundary({ children, fallback }) {
  try {
    return children;
  } catch (error) {
    console.error('StructuredToolResponse error:', error);
    return fallback || (
      <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
        <p className="text-sm text-red-800 dark:text-red-200">
          Failed to render structured response
        </p>
      </div>
    );
  }
}
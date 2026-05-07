import { ScanView } from "@/components/ScanView";

export default function ScanPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Scan barcode</h1>
      <ScanView />
    </div>
  );
}

// Type stub for Capacitor MLKit barcode scanning — the package lives in apps/mobile
// and is only loaded at runtime on native platforms via dynamic import().
declare module "@capacitor-mlkit/barcode-scanning" {
  export interface Barcode {
    rawValue: string;
    format: string;
  }
  export interface BarcodeScanResult {
    barcodes: Barcode[];
  }
  export const BarcodeScanner: {
    scan(): Promise<BarcodeScanResult>;
  };
}

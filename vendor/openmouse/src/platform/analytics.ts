/** Analytics disabled in the Central Hub distribution. */
export const ANALYTICS_READY_EVENT = "central-hub-analytics-disabled";
export function analyticsEnabled(): boolean {return false;}
export function analyticsAvailable(): boolean {return false;}
export function setAnalyticsEnabled(_enabled: boolean): void {}
export interface DeviceFacts {vendorId?: number; productId?: number; productName?: string; brand?: string}
export function deviceProps(_device?: DeviceFacts | null): Record<string,string|number> {return {};}
export function track(_event: string, _props?: Record<string,unknown>): void {}
export function scrubError(error: unknown): {error_name:string;error_message:string} {return {error_name:error instanceof Error ? error.name : "Error",error_message:String(error)};}

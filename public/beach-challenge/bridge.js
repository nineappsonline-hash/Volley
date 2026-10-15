export const embedded=window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1';
export function notifyHost(type,detail={}){if(embedded)window.parent.postMessage({channel:'playza-beach',type,...detail},location.origin)}

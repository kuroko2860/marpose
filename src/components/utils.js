 // Helpers
 export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
 export const angle = (a, b, c) => {
   const BA = { x: a.x - b.x, y: a.y - b.y };
   const BC = { x: c.x - b.x, y: c.y - b.y };
   const dot = BA.x * BC.x + BA.y * BC.y;
   return (
     (Math.acos(dot / (Math.hypot(BA.x, BA.y) * Math.hypot(BC.x, BC.y))) *
       180) /
     Math.PI
   );
 };
export const bboxFromKeypoints = (kps) => {
   const xs = kps.map((k) => k.x),
     ys = kps.map((k) => k.y);
   return [
     Math.min(...xs),
     Math.min(...ys),
     Math.max(...xs) - Math.min(...xs),
     Math.max(...ys) - Math.min(...ys),
   ];
 };
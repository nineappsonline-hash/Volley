const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// A pointer keeps its original job until release/cancel. Extra fingers never
// replace the joystick or camera pointer and cannot reset another finger's input.
export class TouchInput{
 constructor(){this.reset()}
 reset(){this.pointers=new Map();this.moveId=null;this.lookId=null;this.x=0;this.z=0}
 begin(id,role,x=0,y=0){
  if(this.pointers.has(id)||(role==='move'&&this.moveId!==null)||(role==='look'&&this.lookId!==null))return false;
  this.pointers.set(id,{role,x,y,startX:x,startY:y});if(role==='move')this.moveId=id;if(role==='look')this.lookId=id;return true;
 }
 move(id,x,y,radius=40){const p=this.pointers.get(id);if(!p)return null;
  if(p.role==='move'){
   let dx=(x-p.startX)/radius,dz=-(y-p.startY)/radius,n=Math.hypot(dx,dz);
   const magnitude=clamp((n-.12)/.88,0,1);
   this.x=magnitude?dx/n*magnitude:0;this.z=magnitude?dz/n*magnitude:0;return {role:'move',x:this.x,z:this.z};
  }
  if(p.role==='look'){const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;return {role:'look',dx,dy}}
  return {role:p.role};
 }
 end(id){const p=this.pointers.get(id);if(!p)return null;this.pointers.delete(id);
  if(this.moveId===id){this.moveId=null;this.x=0;this.z=0}if(this.lookId===id)this.lookId=null;return p;
 }
 get looking(){return this.lookId!==null}
}
export function lookDelta(dx,dy,sensitivity=1,touch=false){
 // Discard discontinuities from canceled gestures/pointer-lock warps.
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>180||Math.abs(dy)>180)return {yaw:0,pitch:0};
 const gain=(touch?.003:.002)*sensitivity;
 return {yaw:-dx*gain,pitch:-dy*gain};
}
export function motionVelocity(x,z,yaw,speed=4.5){
 const n=Math.max(1,Math.hypot(x,z));return{x:(x*Math.cos(yaw)-z*Math.sin(yaw))/n*speed,z:(-x*Math.sin(yaw)-z*Math.cos(yaw))/n*speed};
}

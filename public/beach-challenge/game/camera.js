import {clamp} from './simulation.js';
// Vertical assistance only, capped in radians/second. Never chase a ball behind
// the player's head or a ball passing through the eye position.
export function assistedPitch(pitch,yaw,player,ball,dt){
 const dx=ball.x-player.x,dz=ball.z-player.z,distance=Math.hypot(dx,dz);
 if(distance<.75||(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/distance<.2)return pitch;
 const goal=clamp(Math.atan2(ball.y-player.y-1.7,distance),-1.396,1.396);
 const change=(goal-pitch)*(1-Math.exp(-1.1*dt));
 return clamp(pitch+clamp(change,-.45*dt,.45*dt),-1.396,1.396);
}

// Shoulder camera follows the athlete, while aim remains independent of zoom.
export function thirdPersonPose(player,yaw=0,pitch=0,distance=4.2){
 const elevation=clamp(.32-pitch*.55,-.1,1.05),horizontal=Math.cos(elevation)*distance;
 return {x:player.x+Math.sin(yaw)*horizontal,y:Math.max(.6,player.y+1.65+Math.sin(elevation)*distance),z:player.z+Math.cos(yaw)*horizontal,lookX:player.x-Math.sin(yaw)*5,lookY:player.y+1.65+Math.sin(pitch)*5,lookZ:player.z-Math.cos(yaw)*5};
}

/** Desktop third-person orbit keeps the cursor free; only primary click attacks. */
export function desktopPointerAction(camera,button,locked=false){
 if(button!==0&&button!==2)return 'ignore';
 if(camera!=='first')return button===0?'hit':'look';
 return locked?(button===0?'hit':'ignore'):'look';
}
export function zoomDistance(distance,delta,mode=0){
 const pixels=delta*(mode===1?16:mode===2?600:1);
 return clamp(distance*Math.exp(clamp(pixels,-1000,1000)*.0015),2.8,12);
}

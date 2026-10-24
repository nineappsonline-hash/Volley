// Original tuning against the supplied gameplay reference. Court units are Playza's.
export const RALLY_PROFILE=Object.freeze({targetPoints:25,winBy:2,serveTimeout:10,runSpeed:7.2,jumpSpeed:8.2,receiveTime:1.12,setTime:1.05,spikeTime:.64});
export const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
export function hitPower(value=1){return bound(Number.isFinite(value)?value:1,.25,1)}
export function rallyAim(yaw=0,pitch=0,tip=false,tilt=0,player={x:0,z:5.5}){
 const z=tip?-1.25:bound(-5.5-bound(pitch,-1,1)*3+bound(tilt,-1,1)*2,-10.5,-1.25);
 const forwardZ=-Math.cos(yaw);
 if(forwardZ>=-.1)return {x:bound(player.x-Math.sin(yaw)*8,-6,6),z:bound(player.z+forwardZ*8,-10.5,11)};
 return {x:bound(player.x+Math.tan(yaw)*(z-player.z),-6,6),z};
}
export function rallyShot(kind,{player,aim={x:0,z:-5.5},direction={x:0,z:0},power=1,teamSize=4,boost=false}={}){
 const p=hitPower(power),flightScale=1+(1-p)*.55;
 if(kind==='receive'&&teamSize===4)return {target:{x:bound(player.x*.35+direction.x*2*p,-3.5,3.5),y:1.7,z:bound(2.1+direction.z*1.5*p,.7,6)},time:RALLY_PROFILE.receiveTime*flightScale};
 if(kind==='set')return {target:{x:bound(player.x+direction.x*(1.2+2.3*p),-4.8,4.8),y:2.9+p*.6,z:bound(player.z-1.6+direction.z*(1.2+2.3*p),.6,7.5)},time:RALLY_PROFILE.setTime*flightScale};
 const time=kind==='spike'?(boost?.48:RALLY_PROFILE.spikeTime)*flightScale:kind==='tip'?.95:kind==='dive'?1.6:1.6;
 return {target:{x:aim.x,z:aim.z},time};
}
export function rallyWon(points){return Math.max(...points)>=RALLY_PROFILE.targetPoints&&Math.abs(points[0]-points[1])>=RALLY_PROFILE.winBy}

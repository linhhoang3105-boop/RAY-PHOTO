const BEAUTY_SHAPES={
  oval:[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
  lip:[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185],
  mouth:[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191],
  eyeL:[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
  eyeR:[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466],
  browL:[70,63,105,66,107,55,65,52,53,46],browR:[300,293,334,296,336,285,295,282,283,276]
};
function beautyPolygon(ctx,face,ids,W,H,ox=0,oy=0,sx=1,sy=1){
  if(ids.some(id=>!face[id]||!Number.isFinite(face[id].x)||!Number.isFinite(face[id].y)))return false;
  ids.forEach((id,i)=>{const p=face[id],x=(p.x*W-ox)*sx,y=(p.y*H-oy)*sy;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.closePath();return true;
}
function beautyValidFaces(faces){
  return (faces||[]).filter(face=>face.length>=468&&BEAUTY_SHAPES.oval.every(i=>face[i]&&Number.isFinite(face[i].x)&&Number.isFinite(face[i].y))&&
    Math.hypot(face[234].x-face[454].x,face[234].y-face[454].y)>.018&&Math.hypot(face[10].x-face[152].x,face[10].y-face[152].y)>.025);
}
function beautyProtectSkin(maps,faces){
  const {width:W,height:H}=maps;
  if(!faces.length)return maps;
  const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(1,Math.max(W,H)/800);
  for(const face of faces)for(const shape of ["eyeL","eyeR","lip","browL","browR"]){
    ctx.beginPath();if(beautyPolygon(ctx,face,BEAUTY_SHAPES[shape],W,H)){ctx.fill();ctx.stroke();}
  }
  const block=ctx.getImageData(0,0,W,H).data,skin=maps.skin.slice();
  for(let i=0;i<skin.length;i++)skin[i]=skin[i]*(1-block[i*4+3]/255);
  canvas.width=canvas.height=0;return {...maps,skin};
}
function beautyFaceGeometry(face){
  const oval=BEAUTY_SHAPES.oval.map(i=>face[i]),left=Math.min(...oval.map(p=>p.x)),right=Math.max(...oval.map(p=>p.x));
  const top=Math.min(...oval.map(p=>p.y)),bottom=Math.max(...oval.map(p=>p.y)),nose=face[1];
  return {cx:(left+right)/2,cy:(top+bottom)/2,w:Math.max(.002,right-left),h:Math.max(.002,bottom-top),left,right,top,bottom,
    nx:nose&&Number.isFinite(nose.x)?nose.x:(left+right)/2,ny:nose&&Number.isFinite(nose.y)?nose.y:(top+bottom)/2};
}
function beautyBuildPeople(faces){
  const ordered=beautyValidFaces(faces).slice(0,10).map(face=>({face,g:beautyFaceGeometry(face)})).sort((a,b)=>a.g.cx-b.g.cx||a.g.cy-b.g.cy);
  if(!ordered.length)return false;
  const old=BEAUTY.people,selectedId=old[BEAUTY.selected]?.id,pairs=[],used=new Set(),matches=new Map();
  for(let i=0;i<ordered.length;i++)for(let j=0;j<old.length;j++){
    const a=ordered[i].g,b=old[j].g,dx=(a.nx-b.nx)/Math.max(a.w,b.w),dy=(a.ny-b.ny)/Math.max(a.h,b.h);
    pairs.push({i,j,d:dx*dx+dy*dy});
  }
  pairs.sort((a,b)=>a.d-b.d);
  for(const {i,j,d}of pairs)if(d<.65*.65&&!matches.has(i)&&!used.has(j)){matches.set(i,j);used.add(j);}
  const fallback=old.length?BEAUTY_DEFAULT:BEAUTY.values;
  BEAUTY.people=ordered.map(({face,g},i)=>{
    const previous=matches.has(i)?old[matches.get(i)]:null;
    return {id:previous?previous.id:++BEAUTY.nextPerson,face,g,values:previous?previous.values:{...fallback},ready:{skin:false,smooth:false,hair:false,face:true}};
  });
  // Cùng một ảnh: lần nhận diện thiếu người không được xóa thiết lập đã có.
  for(let j=0;j<old.length&&BEAUTY.people.length<10;j++)if(!used.has(j))BEAUTY.people.push(old[j]);
  BEAUTY.people.sort((a,b)=>a.g.cx-b.g.cx||a.g.cy-b.g.cy);
  BEAUTY.faces=BEAUTY.people.map(p=>p.face);
  const index=BEAUTY.people.findIndex(p=>p.id===selectedId);BEAUTY.selected=index<0?0:index;
  BEAUTY.values=BEAUTY.people[BEAUTY.selected].values;return true;
}
function beautyHasHair(map){
  if(!map?.length)return false;
  let coverage=0,peak=0;
  for(const value of map){coverage+=value/255;peak=Math.max(peak,value);}
  return peak>=32&&coverage>=Math.max(4,map.length*.00002);
}
function beautyKeepHair(found,previous){
  const next=found.maps;
  if(!next||!previous||beautyHasHair(next.hair)||!beautyHasHair(previous.hair))return;
  const W=next.width,H=next.height,MW=previous.width,MH=previous.height,hair=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=Math.max(0,Math.min(MW-1,(x+.5)*MW/W-.5)),v=Math.max(0,Math.min(MH-1,(y+.5)*MH/H-.5)),xx=Math.floor(u),yy=Math.floor(v),fx=u-xx,fy=v-yy,x1=Math.min(MW-1,xx+1),y1=Math.min(MH-1,yy+1),old=previous.hair;
    hair[y*W+x]=Math.round((old[yy*MW+xx]*(1-fx)+old[yy*MW+x1]*fx)*(1-fy)+(old[y1*MW+xx]*(1-fx)+old[y1*MW+x1]*fx)*fy);
  }
  found.maps={...next,hair};
  found.warnings=[...(found.warnings||[]),'Lần quét này chưa tìm rõ tóc; đã giữ vùng tóc của lần quét trước trên cùng ảnh.'];
}
function beautyExtendHairOwners(m,owners){
  // Continue a person's color through their connected long hair, without
  // guessing across touching heads or disconnected background detections.
  const W=m.width,H=m.height,N=W*H,seen=new Uint8Array(N),queue=new Int32Array(N);
  const eligible=k=>m.hair[k]>=8&&(!m.skin||m.skin[k]<160);
  for(let start=0;start<N;start++){
    if(seen[start]||!eligible(start))continue;
    let head=0,tail=1,owner=0,conflict=false;queue[0]=start;seen[start]=1;
    while(head<tail){
      const k=queue[head++],known=owners[k];
      if(known&&m.hair[k]>=96){if(owner&&owner!==known)conflict=true;else owner=known;}
      const x=k%W;
      for(let dir=0;dir<4;dir++){
        const next=dir===0?(x?k-1:-1):dir===1?(x+1<W?k+1:-1):dir===2?(k>=W?k-W:-1):(k+W<N?k+W:-1);
        if(next<0||seen[next]||!eligible(next))continue;
        seen[next]=1;queue[tail++]=next;
      }
    }
    if(owner&&!conflict)for(let i=0;i<tail;i++)if(!owners[queue[i]])owners[queue[i]]=owner;
  }
}
function beautyAssignPeople(){
  const m=BEAUTY.maps,people=BEAUTY.people,n=people.length;
  if(!n)return;
  const has=map=>{let count=0;for(const v of map)if(v>80)count++;return count>=Math.max(8,map.length*.00015);};
  if(!m){for(const p of people){p.body=false;p.ready={skin:false,smooth:false,hair:false,face:true};}return;}
  if(n===1){
    delete m.skinOwners;delete m.hairOwners;
    const skin=has(m.skin);people[0].body=true;people[0].ready={skin,smooth:skin,hair:beautyHasHair(m.hair),face:true};return;
  }
  const {width:W,height:H}=m,skinOwners=new Uint8Array(W*H),hairOwners=new Uint8Array(W*H);
  const instances=(BEAUTY.instances||[]).filter(p=>p.width>=2&&p.height>=2&&p.data&&p.data.length===p.width*p.height&&p.landmarks?.[0]);
  const pairs=[],matched=new Map(),used=new Set();
  for(let i=0;i<n;i++)for(let j=0;j<instances.length;j++){
    const g=people[i].g,nose=instances[j].landmarks[0],dx=(nose.x-g.nx)/g.w,dy=(nose.y-g.ny)/g.h;
    if(Number.isFinite(dx)&&Number.isFinite(dy))pairs.push({i,j,d:dx*dx+dy*dy});
  }
  pairs.sort((a,b)=>a.d-b.d);
  for(const {i,j,d}of pairs)if(d<.85*.85&&!used.has(i)&&!matched.has(j)){used.add(i);matched.set(j,i+1);}
  const poses=instances.map((p,j)=>{
    const X=new Int32Array(W);for(let x=0;x<W;x++)X[x]=Math.min(p.width-1,Math.floor((x+.5)*p.width/W));
    return {...p,X,owner:matched.get(j)||0};
  });
  const skinHits=new Int32Array(n),hairHits=new Float64Array(n),hairPeaks=new Uint8Array(n),headDistance=new Float32Array(n),bodyDistance=new Float32Array(n);
  for(let y=0;y<H;y++){
    const v=(y+.5)/H;for(const p of poses)p.row=Math.min(p.height-1,Math.floor((y+.5)*p.height/H))*p.width;
    for(let x=0;x<W;x++){
      const k=y*W+x;if(!m.skin[k]&&!m.hair[k])continue;
      const u=(x+.5)/W;let faceBest=Infinity,faceIndex=0,headBest=Infinity,headSecond=Infinity,headIndex=0,bodyBest=Infinity;
      for(let i=0;i<n;i++){
        const g=people[i].g,dx=(u-g.cx)/(.55*g.w),dy=(v-g.cy)/(.55*g.h),df=dx*dx+dy*dy;
        if(df<faceBest){faceBest=df;faceIndex=i+1;}
        const hx=(u-g.cx)/(.95*g.w),hy=(v-g.cy+.20*g.h)/(.95*g.h),dh=hx*hx+hy*hy;headDistance[i]=dh;
        if(dh<headBest){headSecond=headBest;headBest=dh;headIndex=i+1;}else if(dh<headSecond)headSecond=dh;
        const bx=(u-g.cx)/Math.max(.04,1.2*g.w),by=Math.max(0,(g.bottom-v)/g.h)*3+Math.max(0,(v-g.bottom)/g.h)*.12;
        bodyDistance[i]=bx*bx+by*by;bodyBest=Math.min(bodyBest,bodyDistance[i]);
      }
      let best=0,second=0,poseOwner=0;
      for(const p of poses){const confidence=p.data[p.row+p.X[x]];if(confidence>best){second=best;best=confidence;poseOwner=p.owner;}else if(confidence>second)second=confidence;}
      const certain=best>=150&&best-second>=26;
      if(m.skin[k]){
        // Mặt có mốc riêng; da cơ thể chỉ nhận khi mask của từng người đủ rõ.
        const owner=faceBest<=1.04?faceIndex:certain&&poseOwner&&bodyDistance[poseOwner-1]<=bodyBest+.5?poseOwner:0;skinOwners[k]=owner;
        if(owner&&m.skin[k]>80)skinHits[owner-1]++;
      }
      if(m.hair[k]){
        let owner=0;
        if(headBest<=1&&headSecond-headBest>.08&&!(certain&&!poseOwner))owner=headIndex;
        else if(certain&&poseOwner&&headDistance[poseOwner-1]<9&&headDistance[poseOwner-1]<=headBest+.35)owner=poseOwner;
        hairOwners[k]=owner;if(owner&&m.hair[k]>80)hairHits[owner-1]++;
      }
    }
  }
  beautyExtendHairOwners(m,hairOwners);
  hairHits.fill(0);for(let k=0;k<hairOwners.length;k++)if(hairOwners[k]){const owner=hairOwners[k]-1;hairHits[owner]+=m.hair[k]/255;hairPeaks[owner]=Math.max(hairPeaks[owner],m.hair[k]);}
  m.skinOwners=skinOwners;m.hairOwners=hairOwners;
  for(let i=0;i<n;i++){people[i].body=used.has(i);people[i].ready={skin:skinHits[i]>=8,smooth:skinHits[i]>=8,hair:hairHits[i]>=4&&hairPeaks[i]>=32,face:true};}
  BEAUTY.ready.hair=people.some(person=>person.ready.hair);
}
function beautySettings(){return BEAUTY.people.length?BEAUTY.people.map(p=>p.values):[BEAUTY.values];}
function beautySelectedReady(){return BEAUTY.people[BEAUTY.selected]?.ready||BEAUTY.ready;}
function beautySetValue(key,value){BEAUTY.values[key]=value;beautyUI();queue();}
function beautySelectPerson(index){
  if(BEAUTY.busy||!Number.isInteger(index)||!BEAUTY.people[index])return;
  BEAUTY.selected=index;BEAUTY.values=BEAUTY.people[index].values;beautyUI();
}

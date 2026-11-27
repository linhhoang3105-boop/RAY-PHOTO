import {validateShared,cleanCode,MAX_BYTES} from '../dist/darkroom/preset-rules.mjs';
const DAY=86400000;
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const random=n=>{const bytes=new Uint8Array(n);crypto.getRandomValues(bytes);return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');};
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function limit(db,key,max,now){const bucket=Math.floor(now/DAY);await db.prepare('INSERT INTO ray_limits (id, bucket, count) VALUES (?, ?, 1) ON CONFLICT(id, bucket) DO UPDATE SET count=count+1').bind(key,bucket).run();const row=await db.prepare('SELECT count FROM ray_limits WHERE id=? AND bucket=?').bind(key,bucket).first();return Number(row?.count)<=max;}
async function session(request,db,now){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)ray_visitor=([0-9a-f]{64})(?:;|$)/)?.[1];if(!token)return null;return db.prepare('SELECT id, csrf FROM ray_visitors WHERE id=? AND expires_at>?').bind(await hash(token),now).first();}
export async function handleRayAPI(request,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/ray/'))return null;const db=env.DB,now=Date.now();if(!db)return json({error:'Chưa kết nối được kho công thức. Công thức và nháp trên máy vẫn được giữ.'},503);
 try{
  const path=url.pathname.slice('/api/ray/'.length),write=!['GET','HEAD'].includes(request.method);
  if(write&&request.headers.get('origin')!==url.origin)return json({error:'Yêu cầu cần gửi từ RAY PHOTO.'},403);
  if(path==='session'&&request.method==='GET'){
   let visitor=await session(request,db,now),cookie;
   if(!visitor){const ip=request.headers.get('cf-connecting-ip')||'local';if(!await limit(db,'session:'+await hash(ip),100,now))return json({error:'Bạn đã thử nhiều lần. Vui lòng quay lại sau.'},429);const token=random(32);visitor={id:await hash(token),csrf:random(24)};await db.prepare('INSERT INTO ray_visitors (id, csrf, expires_at) VALUES (?, ?, ?)').bind(visitor.id,visitor.csrf,now+180*DAY).run();cookie='ray_visitor='+token+'; Path=/api/ray/; HttpOnly; SameSite=Strict; Max-Age=15552000'+(url.protocol==='https:'?'; Secure':'');}
   return json({nonce:/^[0-9a-f-]{32,36}$/.test(url.searchParams.get('nonce')||'')?url.searchParams.get('nonce'):null,csrf:visitor.csrf,freeAccess:true},200,cookie?{'set-cookie':cookie}:{});
  }
  const visitor=await session(request,db,now);
  if(write&&(!visitor||request.headers.get('x-ray-csrf')!==visitor.csrf))return json({error:'Phiên chia sẻ đã hết hạn. Mở lại Màu của tôi rồi thử lại.'},401);
  if(path==='presets'&&request.method==='POST'){
   if(Number(request.headers.get('content-length')||0)>MAX_BYTES+1000)return json({error:'Công thức vượt dung lượng tạo mã chia sẻ. Màu đã lưu trên thiết bị vẫn dùng được.'},413);
   const text=await request.text();if(new TextEncoder().encode(text).length>MAX_BYTES+1000)return json({error:'Công thức vượt dung lượng tạo mã chia sẻ. Màu đã lưu trên thiết bị vẫn dùng được.'},413);const recipe=validateShared(JSON.parse(text));
   if(!await limit(db,'share:'+visitor.id,30,now))return json({error:'Bạn đã chia sẻ 30 công thức hôm nay. Các bản đã lưu vẫn dùng được.'},429);
   for(let i=0;i<10;i++){const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);if(bytes[0]>=4200000000)continue;const code=String(bytes[0]%100000000).padStart(8,'0');const result=await db.prepare('INSERT OR IGNORE INTO ray_presets (code, owner_id, recipe, created_at) VALUES (?, ?, ?, ?)').bind(code,visitor.id,JSON.stringify(recipe),now).run();if(result.meta?.changes)return json({code,recipe,requiresPremium:false},201);}
   return json({error:'Chưa tạo được mã mới. Công thức trên máy vẫn được giữ; hãy thử lại.'},503);
  }
  if(path.startsWith('presets/')&&request.method==='GET'){
   const key=visitor?.id||await hash(request.headers.get('cf-connecting-ip')||'local');if(!await limit(db,'read:'+key,240,now))return json({error:'Bạn đã tìm quá nhiều mã hôm nay. Vui lòng thử lại sau.'},429);const code=cleanCode(path.slice(8)),row=await db.prepare('SELECT recipe FROM ray_presets WHERE code=?').bind(code).first();if(!row)return json({error:'Chưa tìm thấy mã màu này. Hãy kiểm tra lại 8 chữ số.'},404);const recipe=validateShared(JSON.parse(row.recipe));return json({code,recipe,requiresPremium:false});
  }
  return json({error:'Không có thao tác này.'},404);
 }catch(error){if(error instanceof SyntaxError||/công thức|Công thức|Thông số|Tên màu|Hãy đặt|Mã màu|Kiểu hiệu ứng|phiên bản|Phiên bản|Vùng vẽ|Nét vùng|Điểm vẽ|Kiểu vùng/.test(error.message))return json({error:error.message},400);return json({error:'Chưa kết nối được kho mã. Công thức và nháp trên thiết bị vẫn được giữ.'},503);}
}

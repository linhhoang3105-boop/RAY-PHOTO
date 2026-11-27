/* A separate database avoids upgrading or overwriting the existing photo/draft stores. */
export function presetStore(factory=indexedDB){
 let pending;const open=()=>pending||=(new Promise((resolve,reject)=>{const r=factory.open('ray-photo-my-colors',1);r.onupgradeneeded=()=>r.result.createObjectStore('presets',{keyPath:'id'});r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();pending=null;};resolve(r.result);};r.onerror=()=>{pending=null;reject(new Error('Chưa lưu được màu trên thiết bị. Kiểm tra dung lượng hoặc chế độ riêng tư.'));};}));
 async function request(mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('presets',mode),r=fn(tx.objectStore('presets'));let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Chưa lưu được màu. Công thức đang chỉnh chưa bị xóa.'));});}
 return{all:()=>request('readonly',s=>s.getAll()),get:id=>request('readonly',s=>s.get(id)),put:record=>request('readwrite',s=>s.put(record))};
}

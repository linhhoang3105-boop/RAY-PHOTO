/* One-tap, device-local capture. Rendering and sharing keep their existing paths. */
import * as Rules from './preset-rules.mjs';

export async function saveCreativeSnapshot({store,session,preview=()=>null}){
 const documentKey=session.documentKey;
 await session.ensureSaved();
 const samePhoto=()=>{if(!documentKey||documentKey!==session.documentKey)throw new Error('Ảnh đã thay đổi. Bấm Lưu công thức để giữ màu của ảnh mới.');};
 samePhoto();
 const snapshot=session.snapshot(),state=session.serialize();
 let picture;try{picture=Promise.resolve(preview()).catch(()=>null);}catch{picture=Promise.resolve(null);}
 const items=await store.all();
 const next=1+items.reduce((max,item)=>Math.max(max,Number(item.creativeNumber)||0,Number(/^Công thức (\d+)$/.exec(item.name)?.[1])||0),0);
 const name='Công thức '+String(next).padStart(2,'0'),recipe=Rules.capture(snapshot,name),photoHasLocalEdits=Rules.projectAdvanced(snapshot);
 samePhoto();
 // Advanced edits stay in a separate full photo draft even as the current photo changes.
 const photoDraftId=photoHasLocalEdits?await session.forkDraft(state,name,{variant:'creative',advancedDraft:true}):documentKey;
 const now=Date.now(),record={id:crypto.randomUUID?.()||[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join(''),name,recipe,creativeNumber:next,created:now,updated:now,draft:false,requiresPremium:false,parentId:null,code:null,photoDraftId,photoHasLocalEdits,thumbnail:await picture};
 await store.put(record);
 return record;
}

/* A bounded, non-destructive timeline. Snapshots contain settings, never flattened photos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayEditHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 class Timeline{
  constructor(limit=80){this.limit=limit;this.entries=[];this.cursor=-1;}
  reset(snapshot,label='Ảnh ban đầu'){this.entries=[{snapshot,label}];this.cursor=0;return snapshot;}
  push(snapshot,label='Điều chỉnh'){
   if(this.cursor>=0&&this.entries[this.cursor].snapshot.key===snapshot.key)return false;
   this.entries.splice(this.cursor+1);this.entries.push({snapshot,label});
   if(this.entries.length>this.limit)this.entries.shift();this.cursor=this.entries.length-1;return true;
  }
  get canUndo(){return this.cursor>0;}get canRedo(){return this.cursor<this.entries.length-1;}
  replaceCurrent(snapshot,label='Áp dụng'){
   if(this.cursor<0)return this.reset(snapshot,label);
   this.entries.splice(this.cursor+1);this.entries[this.cursor]={snapshot,label};return snapshot;
  }
  undo(){if(!this.canUndo)return null;return this.entries[--this.cursor].snapshot;}
  redo(){if(!this.canRedo)return null;return this.entries[++this.cursor].snapshot;}
  current(){return this.entries[this.cursor]?.snapshot||null;}
  serialize(){return{entries:this.entries.slice(),cursor:this.cursor};}
  restore(data){
   if(!data||!Array.isArray(data.entries)||!data.entries.length||data.entries.some(e=>!e.snapshot||typeof e.snapshot.key!=='string'))throw new Error('Bản nháp không hợp lệ.');
   if(!Number.isInteger(data.cursor)||data.cursor<0||data.cursor>=data.entries.length)throw new Error('Lịch sử chỉnh ảnh không hợp lệ.');
   const offset=Math.max(0,data.entries.length-this.limit);this.entries=data.entries.slice(offset);this.cursor=Math.max(0,data.cursor-offset);return this.current();
  }
 }
 return{Timeline};
});

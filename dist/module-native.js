/* Bridge Web Share/download gestures to bundled native gallery and share APIs. */
(() => {const native=window.parent!==window?window.parent.BuongToiNative:window.BuongToiNative;if(!native?.isNative)return;
 try{Object.defineProperty(navigator,'canShare',{configurable:true,value:({files}={})=>Array.isArray(files)&&files.length>0&&files.every(f=>f.size>0)});Object.defineProperty(navigator,'share',{configurable:true,value:({files})=>native.shareFiles(files)});}catch{}
 document.addEventListener('click',async e=>{const a=e.target.closest('a[download]');if(!a?.href||!a.download)return;e.preventDefault();try{const blob=await(await fetch(a.href)).blob();await native.saveFile({blob,name:a.download});window.parent.BuongToiHost?.toast('Đã lưu vào thư viện Ảnh của máy.');}catch(error){window.parent.BuongToiHost?.toast(error.message||'Chưa lưu được. Thử nút chia sẻ.',true);}},true);
})();

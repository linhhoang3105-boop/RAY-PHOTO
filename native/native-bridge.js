import {Capacitor,registerPlugin} from '@capacitor/core';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {App} from '@capacitor/app';
import {StatusBar,Style} from '@capacitor/status-bar';
import {Haptics,ImpactStyle} from '@capacitor/haptics';
const Gallery=registerPlugin('BuongToiMedia');
const isNative=Capacitor.isNativePlatform();
const toBase64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Chưa đọc được tệp để lưu.'));reader.readAsDataURL(blob);});
async function localFile(file){const blob=file.blob||file,name=String(file.name||('ray-photo-'+Date.now()+'.jpg')).replace(/[^\p{L}\p{N}._-]/gu,'-');const result=await Filesystem.writeFile({path:'buong-toi/'+Date.now()+'-'+name,data:await toBase64(blob),directory:Directory.Cache,recursive:true});return{uri:result.uri,mime:blob.type,name};}
window.BuongToiNative={
 isNative,
 async tap(){if(isNative)try{await Haptics.impact({style:ImpactStyle.Light});}catch{}},
 async saveFile(file){if(!isNative)throw new Error('Lưu trực tiếp cần bản app.');const local=await localFile(file);try{return await Gallery.save({path:local.uri,mimeType:local.mime,name:local.name});}finally{try{await Filesystem.deleteFile({path:local.uri});}catch{}}},
 async shareFiles(files){if(!isNative)throw new Error('Chia sẻ native cần bản app.');const paths=[];for(const file of files)paths.push((await localFile(file)).uri);await Share.share({title:'RAY PHOTO',files:paths,dialogTitle:'Lưu hoặc chia sẻ kỷ niệm'});},
};
if(isNative){
 StatusBar.setStyle({style:Style.Dark}).catch(()=>{});
 App.addListener('appStateChange',({isActive})=>{if(!isActive)document.getElementById('boothFrame')?.contentWindow?.PhoCangBridge?.deactivate();});
 App.addListener('backButton',()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return;}if(location.hash&&location.hash!=='#home'){window.BuongToiHost?.showView('home');return;}App.minimizeApp();});
}

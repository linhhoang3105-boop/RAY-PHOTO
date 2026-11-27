/* Both makeup screens share local hair/skin recognition and model cleanup. */
(function(root){
 'use strict';
 const base=new URL('./vendor/mediapipe/',document.currentScript.src).href;
 async function detect(image,progress=()=>{}){
  let run;
  try{
   run=await root.RayBeautyRuntime.engine({roots:[base.replace(/\/$/,'')],
    segment:base+'selfie_multiclass_256x256.tflite',hair:base+'hair_segmenter.tflite',
    face:base+'face_landmarker.task',numFaces:3,kinds:['segment','hair','face']});
   const out=await run.detect(image,progress),m=out.maps;
   const hair=m?.hair?{width:m.width,height:m.height,values:Float32Array.from(m.hair,v=>v/255),refined:true}:null;
   return {faces:out.faces||[],hair,errors:out.errors||[],warnings:out.warnings||[]};
  }catch{
   return {faces:[],hair:null,errors:['face','hair']};
  }finally{if(run)await run.close();}
 }
 root.MakeupDetection={detect};
})(globalThis);

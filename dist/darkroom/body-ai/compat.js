/* v48 body-only adapter. Face recipes ride the existing BODY snapshot/draft path.
   No source pixels, color parameters, old scripts or AI assets are replaced. */
const BODY_FINE = {
  get strokes(){ return bodyPart('face')?.ray67FaceStrokes || []; },
  set strokes(value){
    const face = bodyPart('face');
    if(!face) return;
    // Immutable arrays: v48 history shallow-copies each body part.
    if(value.length) face.ray67FaceStrokes = value;
    else delete face.ray67FaceStrokes;
  }
};
function rayFineWarp(context, width, height){}
/* v48 refines through an offscreen full-size canvas. A v67 pending preview is
   intentionally limited to the visible canvas. Hold ONLY that refinement while
   a body preview is pending, then resume the unchanged v48 quality pipeline. */
window.RayBodyPreview48 = (() => {
  let resume = null, releaseTimer = 0;
  const pending = () => !!source && document.body.dataset.editorTool === 'body'
    && (!!window.RayFace55?.previewActive || !!window.RayRatioLive?.active);
  function sync(){
    if(pending()){
      if(releaseTimer){ clearTimeout(releaseTimer); releaseTimer = 0; }
      if(!resume) resume = window.RayPreview?.pause?.() || null;
    }else if(resume && !releaseTimer){
      // Release after draw() returns: its own schedule sees the hold and cannot
      // enqueue a second full-size render alongside the resumed refinement.
      releaseTimer = setTimeout(() => {
        releaseTimer = 0;
        if(pending()) return;
        const release = resume; resume = null; release?.();
      }, 0);
    }
  }
  if(window.MutationObserver) new MutationObserver(sync).observe(document.body,
    {attributes:true,attributeFilter:['data-editor-tool']});
  return {sync,get active(){return !!resume;}};
})();
(() => {
  const warp48 = bodyWarp;
  bodyWarp = function(context, width, height){
    warp48(context, width, height);
    if(!BODY.peek) rayFineWarp(context, width, height);
  };
  const restore48 = bodyRestore;
  bodyRestore = function(json){
    // Older body-undo entries predate this add-on. Object.assign alone would
    // leave these extra keys behind, making an undone face still visible.
    const saved = JSON.parse(json);
    for(const part of BODY.parts){
      const prior = saved.find(item => item.id === part.id);
      for(const key of ['ray67FaceStrokes', 'ray54wid', 'ray54len', 'ray67BaseRx', 'ray67BaseRy', 'rayPose']){
        if(!prior || !Object.prototype.hasOwnProperty.call(prior, key)) delete part[key];
      }
    }
    window.RayFace55?.cancelPreview();
    window.RayRatioLive?.cancel();
    return restore48(json);
  };
  const reset = document.getElementById('bodyReset1');
  if(reset) reset.onclick = () => {
    const part = bodyPart(BODY.sel);
    if(!part) return;
    window.RayFace55?.cancelPreview();
    window.RayRatioLive?.cancel();
    bodyEnd(); bodyBegin('reset');
    part.size = part.wid = part.len = part.push = 0;
    part.dir = 0; part.soft = .5;
    if(Number.isFinite(part.ray67BaseRx)) part.rx = part.ray67BaseRx;
    if(Number.isFinite(part.ray67BaseRy)) part.ry = part.ray67BaseRy;
    delete part.ray67FaceStrokes;
    delete part.ray54wid;
    delete part.ray54len;
    delete part.ray67BaseRx;
    delete part.ray67BaseRy;
    bodyUI(); syncBody(); queue(); bodyEnd();
  };
})();

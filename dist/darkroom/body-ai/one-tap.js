/* Only Chỉnh dáng receives the v67 AI actions. The v48 toolbar is untouched. */
(() => {
  const $ = id => document.getElementById(id);
  const pending = new Set();
  async function run(button, status, scan, apply, ready){
    if(!source || button.disabled) return;
    const image = source;
    pending.add(button);
    button.disabled = true;
    try{
      const scanned=ready()?undefined:await scan();
      if(image !== source){
        status.textContent = 'Ảnh đã thay đổi. Hãy quét lại ảnh đang mở.';
        return;
      }
      if(scanned!==false&&ready()) apply();
    }catch(error){
      status.textContent = 'Chưa áp dụng được: ' + String(error.message || error);
    }finally{ pending.delete(button); button.disabled = !source; }
  }
  const face = document.createElement('button');
  face.type = 'button'; face.id = 'r48FaceOneTap'; face.className = 'r55-primary';
  face.textContent = '✧ AI · Quét & áp mẫu mặt';
  face.onclick = () => run(face, $('r55Status'), window.RayFace55.scan,
    window.RayFace55.apply, () => !!window.RayFace55.geometry());
  $('r55Scan').parentElement.prepend(face);
  const body = document.createElement('button');
  body.type = 'button'; body.id = 'r48BodyOneTap'; body.className = 'ray62-primary';
  body.textContent = '✧ Quét AI & hiện viền';
  body.onclick = () => {
    const hadRecognition=window.RayBodyPose?.hasRecognition?.()??window.RayOverall62.measure().ok;
    return run(body, $('ray62OverallStatus'), window.RayOverall62.scan,()=>{
      if(hadRecognition)window.RayOverall62.preview();
      else{window.RayRatioLive.cancel();window.RayGeometry54.guides(true,'overall');window.RayOverall62.refresh();}
    },()=>window.RayBodyPose?.hasRecognition?.()??window.RayOverall62.measure().ok);
  };
  $('ray62Scan').parentElement.prepend(body);
  // Buttons are unavailable without a photo; no models run on page load.
  const sync = () => {
    for(const button of [face,body]) button.disabled = pending.has(button) || !source || BEAUTY.busy || BODY_AI.busy;
    const ready=window.RayBodyPose?.hasRecognition?.()??window.RayOverall62.measure().ok;
    body.textContent=BODY_AI.busy?'Đang quét AI…':ready?'Xem trước dáng đã chọn':'Quét AI & hiện viền';
    $('ray62Scan').hidden=!ready;$('ray62Scan').textContent='Quét lại AI';
  };
  setInterval(sync, 1000); sync();
  // Cancel only temporary body previews when using the existing session actions.
  for(const selector of ['.session-history', '.session-apply-bar button:first-child', '#bodyResetAll']){
    document.querySelector(selector)?.addEventListener('click', () => {
      window.RayFace55.cancelPreview(); window.RayRatioLive.cancel();
    }, true);
  }
})();

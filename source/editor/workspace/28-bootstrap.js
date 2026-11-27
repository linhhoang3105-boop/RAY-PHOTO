window.addEventListener("resize", () => {
  if(source){ preview = makePreview(source); queue(); }
  syncOval();
  syncLeakHandle();
  syncNangHandle();
  syncBody();
});

syncControls();
syncOval();
syncLeakHandle();
syncNangHandle();

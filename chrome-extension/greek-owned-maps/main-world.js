(() => {
  const CHANNEL="TGD_MAPS_NATIVE_COPY";
  const allowed=url=>{
    try {
      const u=new URL(url);
      return u.origin==="https://thegreekdirectory.org" && u.pathname.startsWith("/listing/");
    } catch { return false; }
  };

  window.addEventListener("message",event=>{
    const data=event.data;
    if(event.source!==window || event.origin!==location.origin ||
       data?.channel!==CHANNEL || data?.type!=="ARM" ||
       typeof data.token!=="string" || !allowed(data.url)) return;

    const clipboard=navigator.clipboard;
    if(!clipboard || typeof clipboard.writeText!=="function") {
      window.postMessage({channel:CHANNEL,type:"UNAVAILABLE",token:data.token},location.origin);
      return;
    }

    const hadOwn=Object.prototype.hasOwnProperty.call(clipboard,"writeText");
    const ownDescriptor=hadOwn?Object.getOwnPropertyDescriptor(clipboard,"writeText"):null;
    const original=clipboard.writeText.bind(clipboard);
    let used=false;
    let restored=false;
    let timer;

    const restore=()=>{
      if(restored)return;
      restored=true;
      clearTimeout(timer);
      try {
        if(hadOwn && ownDescriptor) Object.defineProperty(clipboard,"writeText",ownDescriptor);
        else delete clipboard.writeText;
      } catch {}
    };

    try {
      Object.defineProperty(clipboard,"writeText",{
        configurable:true,
        writable:true,
        value:function(_mapsValue) {
          if(used) return original(_mapsValue);
          used=true;
          restore();
          let result;
          try { result=original(data.url); }
          catch(error) {
            window.postMessage({channel:CHANNEL,type:"FAILED",token:data.token},location.origin);
            throw error;
          }
          Promise.resolve(result).then(
            ()=>window.postMessage({channel:CHANNEL,type:"COPIED",token:data.token},location.origin),
            ()=>window.postMessage({channel:CHANNEL,type:"FAILED",token:data.token},location.origin)
          );
          return result;
        }
      });
      timer=window.setTimeout(restore,1800);
      window.postMessage({channel:CHANNEL,type:"ARMED",token:data.token},location.origin);
    } catch {
      restore();
      window.postMessage({channel:CHANNEL,type:"UNAVAILABLE",token:data.token},location.origin);
    }
  });
})();
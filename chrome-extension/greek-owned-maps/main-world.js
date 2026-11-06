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
    const originalWrite=clipboard && typeof clipboard.writeText==="function"
      ? clipboard.writeText.bind(clipboard) : null;
    const hadOwnWrite=clipboard ? Object.prototype.hasOwnProperty.call(clipboard,"writeText") : false;
    const ownWriteDescriptor=hadOwnWrite ? Object.getOwnPropertyDescriptor(clipboard,"writeText") : null;

    const originalExec=document.execCommand.bind(document);
    const hadOwnExec=Object.prototype.hasOwnProperty.call(document,"execCommand");
    const ownExecDescriptor=hadOwnExec ? Object.getOwnPropertyDescriptor(document,"execCommand") : null;

    let used=false;
    let restored=false;
    let timer;

    const restore=()=>{
      if(restored)return;
      restored=true;
      clearTimeout(timer);
      try {
        if(clipboard) {
          if(hadOwnWrite && ownWriteDescriptor) Object.defineProperty(clipboard,"writeText",ownWriteDescriptor);
          else delete clipboard.writeText;
        }
      } catch {}
      try {
        if(hadOwnExec && ownExecDescriptor) Object.defineProperty(document,"execCommand",ownExecDescriptor);
        else delete document.execCommand;
      } catch {}
    };

    const announce=(ok)=>{
      window.postMessage({channel:CHANNEL,type:ok?"COPIED":"FAILED",token:data.token},location.origin);
    };

    try {
      if(clipboard && originalWrite) {
        Object.defineProperty(clipboard,"writeText",{
          configurable:true,
          writable:true,
          value:function(_mapsValue) {
            if(used) return originalWrite(_mapsValue);
            used=true;
            restore();
            let result;
            try { result=originalWrite(data.url); }
            catch(error) { announce(false); throw error; }
            Promise.resolve(result).then(()=>announce(true),()=>announce(false));
            return result;
          }
        });
      }
    } catch {
      // Keep trying the native execCommand route below.
    }

    try {
      Object.defineProperty(document,"execCommand",{
        configurable:true,
        writable:true,
        value:function(command,...args) {
          if(String(command).toLowerCase()!=="copy" || used) return originalExec(command,...args);
          used=true;
          restore();

          // Use Google's own native copy command with the TGD URL selected.
          // The Maps click handler receives the original success result and can
          // display its own bottom snackbar.
          const textarea=document.createElement("textarea");
          textarea.value=data.url;
          textarea.setAttribute("readonly","");
          textarea.style.cssText="position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0";
          (document.body||document.documentElement).appendChild(textarea);
          textarea.focus();
          textarea.select();
          let copied=false;
          try { copied=originalExec("copy",...args); }
          catch(error) {
            textarea.remove();
            announce(false);
            throw error;
          }
          textarea.remove();
          announce(Boolean(copied));
          return copied;
        }
      });
    } catch {
      // Clipboard API interception may still be available.
    }

    timer=window.setTimeout(restore,1800);
    window.postMessage({channel:CHANNEL,type:"ARMED",token:data.token},location.origin);
  });
})();
chrome.tabs.query({active:true,currentWindow:true},([tab])=>{
  const el=document.getElementById("status");
  const url=tab?.url||"";
  const isGoogle=url.startsWith("https://www.google.com/maps/")||url.startsWith("https://maps.google.com/maps/");
  const isYelp=url.startsWith("https://www.yelp.com/")||url.startsWith("https://yelp.com/");
  if(!isGoogle&&!isYelp){
    el.textContent="Open Google Maps or Yelp to use the extension.";
    return;
  }
  chrome.runtime.sendMessage({type:"STATUS"},data=>{
    if(chrome.runtime.lastError){
      el.textContent="Extension is active, but its status could not be loaded.";
      return;
    }
    const count=isYelp?(data?.submittedYelp?.length||0):(data?.submitted?.length||0);
    el.textContent="Active on "+(isYelp?"Yelp":"Google Maps")+". "+count+" suggestion(s) submitted from this browser.";
  });
});
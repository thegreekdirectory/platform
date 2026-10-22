export async function onRequest(context) {
  // Extract env to use env.ASSETS.fetch for internal static files
  const { request, next, env } = context;
  const url = new URL(request.url);

  // --- Redirect any mixed-case or uppercase path to lowercase ---
  if (url.pathname !== url.pathname.toLowerCase()) {
    url.pathname = url.pathname.toLowerCase();
    return Response.redirect(url.toString(), 301); //[cite: 2]
  }
  
  const SECRET_PARAM = "access"; //[cite: 2]
  const SECRET_VALUE = "granted"; //[cite: 2]
  const COOKIE_NAME = "access_cookie"; //[cite: 2]

  const cookieHeader = request.headers.get("Cookie") || ""; //[cite: 2]
  const hasCookie = cookieHeader.includes(`${COOKIE_NAME}=${SECRET_VALUE}`); //[cite: 2]
  const hasQuery = url.searchParams.get(SECRET_PARAM) === SECRET_VALUE; //[cite: 2]

  // 1. Check if the current request has the secret query param OR the cookie
  if (!hasQuery && !hasCookie) { //[cite: 2]
    return new Response(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>403 — Forbidden</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#080808;color:#ff2244;font-family:'Share Tech Mono',monospace;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.02) 2px,rgba(255,255,255,.02) 4px);pointer-events:none;z-index:10}body::after{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.85) 100%);pointer-events:none;z-index:9}.wrap{text-align:center;position:relative;z-index:1;user-select:none}.code{font-family:'Bebas Neue',sans-serif;font-size:clamp(130px,25vw,290px);line-height:.85;color:#ff2244;position:relative;animation:g 3s infinite;text-shadow:0 0 60px rgba(255,34,68,.5),0 0 120px rgba(255,34,68,.2)}.code::before,.code::after{content:'403';position:absolute;inset:0}.code::before{color:#0ff;animation:gb 3s infinite;clip-path:polygon(0 0,100% 0,100% 33%,0 33%);mix-blend-mode:screen;opacity:.8}.code::after{color:#ff2244;animation:ga 3s infinite;clip-path:polygon(0 66%,100% 66%,100% 100%,0 100%);mix-blend-mode:screen;opacity:.8}@keyframes g{0%,89%,100%{transform:translate(0)}90%{transform:translate(-3px,1px)}91%{transform:translate(3px,-1px)}92%{transform:translate(0)}93%{transform:translate(4px,2px)}94%{transform:translate(-4px,0)}95%{transform:translate(0)}}@keyframes gb{0%,89%,100%{transform:translate(0)}90%{transform:translate(5px,-3px)}91%{transform:translate(-5px,3px)}92%{transform:translate(0)}93%{transform:translate(-6px,1px)}94%{transform:translate(6px,0)}95%{transform:translate(0)}}@keyframes ga{0%,89%,100%{transform:translate(0)}90%{transform:translate(-4px,4px)}91%{transform:translate(4px,-4px)}92%{transform:translate(0)}93%{transform:translate(7px,-1px)}94%{transform:translate(-7px,1px)}95%{transform:translate(0)}}.lbl{font-size:clamp(11px,2vw,17px);letter-spacing:.55em;text-transform:uppercase;margin-top:6px;animation:fl 5s infinite}.div{width:100px;height:1px;background:linear-gradient(90deg,transparent,#ff2244,transparent);margin:22px auto;animation:pu 2s infinite}.msg{font-size:clamp(9px,1.4vw,12px);letter-spacing:.2em;color:rgba(255,34,68,.45);margin-top:4px;text-transform:uppercase}@keyframes fl{0%,93%,100%{opacity:.9}94%{opacity:.2}95%{opacity:.9}97%{opacity:.05}98%{opacity:.9}}@keyframes pu{0%,100%{opacity:.4;transform:scaleX(1)}50%{opacity:1;transform:scaleX(1.4)}}.bar{width:50px;height:2px;background:#ff2244;margin:0 auto 18px;overflow:hidden;position:relative}.bar::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:rgba(255,255,255,.6);animation:sw 1.8s infinite}@keyframes sw{0%{left:-100%}100%{left:200%}}.c{position:fixed;font-size:9px;letter-spacing:.12em;color:rgba(255,34,68,.2);text-transform:uppercase}.tl{top:20px;left:20px}.tr{top:20px;right:20px}.bl{bottom:20px;left:20px}.br{bottom:20px;right:20px}.grid{position:fixed;inset:0;background-image:linear-gradient(rgba(255,34,68,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,34,68,.03) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0}</style><script src="/js/translation-load.js"></script></head><body><div class="grid"></div><span class="c tl">SYS//ERR.LOG</span><span class="c tr">CODE::403</span><span class="c bl">ACCESS_CTRL</span><span class="c br">NODE_DENIED</span><div class="wrap"><div class="bar"></div><div class="code">403</div><div class="lbl">Access Forbidden</div><div class="div"></div><div class="msg">You do not have permission to access this resource</div></div></body></html>`,
      {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      }); //[cite: 2]
  }

  // 2. Get the actual response
  const response = await next(); //[cite: 2]
  
  // 3. Process HTML responses with HTMLRewriter for server-side partials
  const contentType = response.headers.get("Content-Type") || "";
  let finalResponse;

  if (contentType.includes("text/html")) {
    // Fetch the partials internally
    const headerRes = await env.ASSETS.fetch(new URL('/partials/header.html', request.url)); //[cite: 1]
    const footerRes = await env.ASSETS.fetch(new URL('/partials/footer.html', request.url)); //[cite: 1]
    
    const headerHtml = headerRes.ok ? await headerRes.text() : "";
    const footerHtml = footerRes.ok ? await footerRes.text() : "";

    const rewriter = new HTMLRewriter()
      .on('[data-partial="header"]', { //[cite: 1]
        element(element) {
          if (headerHtml) element.setInnerContent(headerHtml, { html: true });
        }
      })
      .on('[data-partial="footer"]', { //[cite: 1]
        element(element) {
          if (footerHtml) element.setInnerContent(footerHtml, { html: true });
        }
      })
      .on('body', {
        element(element) {
          // Preserve exact client-side event dispatching and translation logic
          element.append(`
            <script>
              document.addEventListener('DOMContentLoaded', () => {
                if (window.translationSystem) {
                    window.translationSystem.applyTranslations(); 
                }
                document.dispatchEvent(new CustomEvent('tgd:partials-loaded')); 
              });
            </script>
          `, { html: true }); //[cite: 1]
        }
      });

    finalResponse = rewriter.transform(response);
    finalResponse = new Response(finalResponse.body, finalResponse);
  } else {
    // Leave non-HTML responses untouched
    finalResponse = new Response(response.body, response);
  }

  // 4. Attach the access cookie to the response so the user stays authenticated for 1 year
  finalResponse.headers.append("Set-Cookie", `${COOKIE_NAME}=${SECRET_VALUE}; Path=/; Max-Age=31536000; SameSite=Lax`); //[cite: 2]
  
  return finalResponse;
}

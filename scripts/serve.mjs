import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');const port=Number(process.env.STUDY_PREVIEW_PORT||4178);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/demo.html':url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}const file=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(file);}catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Study Mode rehearsal: http://127.0.0.1:${port}/demo.html`));

import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const args = process.argv.slice(2);
function option(name,fallback) {
  const index=args.indexOf(name);
  if(index===-1)return fallback;
  if(!args[index+1]||args[index+1].startsWith('--'))throw new Error(`Brak wartości ${name}`);
  return args[index+1];
}
let base=option('--base','/');
base='/' + base.split('/').filter(Boolean).join('/') + '/';
if(base==='//')base='/';
if(base.includes('..')||/[?#\\]/.test(base))throw new Error('Nieprawidłowa ścieżka --base.');
const port=Number(option('--port','5173'));
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port musi być liczbą 1–65535.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};

const server=http.createServer(async(req,res)=>{
  function send(status,message){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':message);}
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');send(405,'Method not allowed');return;}
  try {
    const url=new URL(req.url,'http://localhost');
    if(base!=='/'&&(url.pathname==='/'||url.pathname===base.slice(0,-1))){res.writeHead(302,{Location:base+url.search});res.end();return;}
    if(!url.pathname.startsWith(base)){send(404,'Nie znaleziono pliku.');return;}
    const relative=decodeURIComponent(url.pathname.slice(base.length))||'index.html';
    const file=path.resolve(root,relative);
    const inside=path.relative(root,file);
    if(inside.startsWith('..'+path.sep)||inside==='..'||path.isAbsolute(inside)){send(403,'Forbidden');return;}
    let info;
    try{info=await stat(file);}catch(error){send(error.code==='ENOENT'?404:500,'Nie znaleziono pliku.');return;}
    if(!info.isFile()){send(404,'Nie znaleziono pliku.');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{send(400,'Nieprawidłowe żądanie.');}
});
server.on('error',error=>{console.error(`Nie można uruchomić serwera: ${error.message}`);process.exit(1);});
server.listen(port,'127.0.0.1',()=>{
  console.log(`APEX: http://127.0.0.1:${port}${base}`);
  console.log(`Demo tabletu: http://127.0.0.1:${port}${base}showcase.html`);
  console.log('Zatrzymaj serwer: Ctrl+C.');
});

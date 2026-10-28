import http from 'node:http';
import worker from '../worker/index.js';
const i=process.argv.indexOf('--port');const port=Number(i>=0?process.argv[i+1]:process.env.PORT||3000);
http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const url='https://'+req.headers.host+req.url;const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await worker.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Preview error')}}).listen(port,'0.0.0.0',()=>console.log('PVÖL preview ready on '+port));

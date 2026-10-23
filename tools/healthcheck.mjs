import {request} from 'node:http';
import {loadConfig} from '../server/config.mjs';
const {port,publicOrigin}=loadConfig();
const req=request({host:'127.0.0.1',port,path:'/api/health',headers:{Host:publicOrigin?new URL(publicOrigin).host:`127.0.0.1:${port}`},timeout:3000},res=>{res.resume();res.on('end',()=>{process.exitCode=res.statusCode===200?0:1;});});
req.on('timeout',()=>req.destroy());req.on('error',()=>{process.exitCode=1;});req.end();

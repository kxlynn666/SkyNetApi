const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const { promisify } = require('util');
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const C = require('./config');
const S = require('./store');

const execFileAsync = promisify(execFile);
const MEDIA_FILE = path.join(C.DATA_DIR, 'profile-media.json');
const MAX_SOURCE_MB = 35;
const MAX_OUTPUT_MB = 25;
const MAX_DURATION_SECONDS = 10;
const VIDEO_EXTENSIONS = new Set(['.mp4','.webm','.mov','.m4v','.mkv','.avi']);

function registerProfileMediaRoutes(app) {
    ensureStorage();
    const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:MAX_SOURCE_MB*1024*1024, files:1, fields:8 } });

    app.post('/api/profile-media', requireTrustedOrigin, requireSession, upload.single('file'), async (req,res,next) => {
        try {
            const usage = normalizeUsage(req.body?.usage);
            if (!usage) return res.status(400).json({ok:false,error:'Uso inválido. Escolha avatar ou banner.'});
            const remoteUrl = String(req.body?.url || '').trim();
            if (!req.file && !remoteUrl) return res.status(400).json({ok:false,error:'Envie um arquivo ou informe uma URL.'});
            if (req.file && remoteUrl) return res.status(400).json({ok:false,error:'Use arquivo ou URL, não os dois ao mesmo tempo.'});

            const source = req.file ? { buffer:req.file.buffer, mime:req.file.mimetype||'', name:safeName(req.file.originalname||'arquivo') } : await fetchRemoteMedia(remoteUrl);
            const processed = await processProfileMedia(source, usage);
            const id = randomId();
            const filename = `profile-${id}.${processed.extension}`;
            fs.writeFileSync(path.join(C.UPLOADS_DIR, filename), processed.buffer, {mode:0o600});
            let posterFilename = null;
            if (processed.posterBuffer) {
                posterFilename = `profile-${id}-poster.jpg`;
                fs.writeFileSync(path.join(C.UPLOADS_DIR, posterFilename), processed.posterBuffer, {mode:0o600});
            }

            const state = loadState();
            const record = { id,accountId:req.account.id,usage,kind:processed.kind,mime:processed.mime,filename,posterFilename,sourceName:source.name||'mídia',createdAt:new Date().toISOString(),maxDuration:processed.kind==='video'?MAX_DURATION_SECONDS:null };
            state.records.push(record);
            const selection = ensureSelection(state, req.account.id);
            selection[usage === 'avatar' ? 'avatarMediaId' : 'bannerMediaId'] = id;
            selection.updatedAt = new Date().toISOString();
            pruneAccountRecords(state, req.account.id);
            saveState(state);
            return res.status(201).json({ok:true,media:publicMedia(record),selection:selectionView(req.account.id,state)});
        } catch (error) { return next(error); }
    });

    app.get('/api/profile-media/me', requireSession, (req,res) => {
        res.setHeader('Cache-Control','no-store');
        return res.json({ok:true,...selectionView(req.account.id)});
    });

    app.get('/api/profile-media/public/:username', (req,res) => {
        const username = S.normalizeUsername(req.params.username);
        const account = S.loadAccounts().find(a=>a.active&&S.normalizeUsername(a.usernameLower||a.username)===username);
        if (!account) return res.status(404).json({ok:false,error:'Perfil não encontrado.'});
        res.setHeader('Cache-Control','public, max-age=60');
        return res.json({ok:true,...selectionView(account.id)});
    });

    app.post('/api/profile-media/clear/:usage', requireTrustedOrigin, requireSession, (req,res) => {
        const usage=normalizeUsage(req.params.usage); if(!usage)return res.status(400).json({ok:false,error:'Tipo de mídia inválido.'});
        const state=loadState(),selection=ensureSelection(state,req.account.id);selection[usage==='avatar'?'avatarMediaId':'bannerMediaId']='';selection.updatedAt=new Date().toISOString();saveState(state);return res.json({ok:true,...selectionView(req.account.id,state)});
    });

    app.delete('/api/profile-media/:id', requireTrustedOrigin, requireSession, (req,res) => {
        const state=loadState(),index=state.records.findIndex(r=>r.id===req.params.id&&r.accountId===req.account.id);if(index<0)return res.status(404).json({ok:false,error:'Mídia não encontrada.'});
        const [record]=state.records.splice(index,1);removeRecordFiles(record);const selection=ensureSelection(state,req.account.id);if(selection.avatarMediaId===record.id)selection.avatarMediaId='';if(selection.bannerMediaId===record.id)selection.bannerMediaId='';selection.updatedAt=new Date().toISOString();saveState(state);return res.json({ok:true,...selectionView(req.account.id,state)});
    });

    app.get('/profile-media/:id', (req,res) => serveMedia(req,res,false));
    app.get('/profile-media/:id/poster', (req,res) => serveMedia(req,res,true));

    // Compatibility layer: old profile surfaces receive a static poster URL, while
    // new clients also receive avatarMedia/bannerMedia and can render video loops.
    app.use((req,res,next) => {
        const p=req.path, m=req.method;
        const relevant=m==='GET' && (
            p==='/api/social/me' || p.startsWith('/api/social/profile/') || p==='/api/social/users' || p==='/api/social/friends' || p==='/api/social/podium' ||
            p==='/api/community/profile/me' || p.startsWith('/api/community/profile/') || p==='/api/community/leaderboard' ||
            p.startsWith('/api/profile-v3/profile/') || p==='/api/profile-v3/leaderboard'
        );
        if(!relevant)return next();
        const originalJson=res.json.bind(res);
        res.json=payload=>originalJson(enhancePayload(p,payload,req));
        return next();
    });
}

function enhancePayload(route,payload,req){
    if(!payload?.ok)return payload;
    if(route==='/api/social/me' && payload.account?.id) return {...payload,account:enhanceAvatar(payload.account,payload.account.id)};
    if(route.startsWith('/api/social/profile/') && payload.profile?.id) return {...payload,profile:enhanceAvatar(payload.profile,payload.profile.id)};
    if(route==='/api/social/users' && Array.isArray(payload.users)) return {...payload,users:payload.users.map(v=>enhanceAvatar(v,v.id))};
    if(route==='/api/social/friends') { const out={...payload}; for(const key of ['friends','incoming','outgoing','blocked'])if(Array.isArray(out[key]))out[key]=out[key].map(v=>enhanceAvatar(v,v.id)); return out; }
    if(route==='/api/social/podium' && Array.isArray(payload.podium)) return {...payload,podium:payload.podium.map(v=>enhanceAvatar(v,v.id))};
    if(route==='/api/community/leaderboard' && Array.isArray(payload.leaderboard)) return {...payload,leaderboard:payload.leaderboard.map(v=>enhanceAvatar(v,v.id))};
    if(route==='/api/community/profile/me') { const id=sessionAccountId(req); return id?{...payload,public:enhanceBoth(payload.public||{},id)}:payload; }
    if(route.startsWith('/api/community/profile/') && payload.profile) { const id=payload.profile.id||accountIdByUsername(payload.profile.username); return id?{...payload,profile:enhanceBoth(payload.profile,id)}:payload; }
    if(route.startsWith('/api/profile-v3/profile/') && payload.profile?.id) return {...payload,profile:enhanceBoth(payload.profile,payload.profile.id)};
    if(route==='/api/profile-v3/leaderboard' && Array.isArray(payload.leaderboard)) return {...payload,leaderboard:payload.leaderboard.map(v=>enhanceBoth(v,v.id))};
    return payload;
}
function enhanceAvatar(obj,accountId){if(!obj||!accountId)return obj;const view=selectionView(accountId),media=view.avatar;if(!media)return obj;return{...obj,avatarUrl:media.kind==='video'?media.posterUrl:media.url,avatarMedia:media};}
function enhanceBoth(obj,accountId){if(!obj||!accountId)return obj;const view=selectionView(accountId);let out=enhanceAvatar(obj,accountId);if(view.banner)out={...out,bannerUrl:view.banner.kind==='video'?view.banner.posterUrl:view.banner.url,bannerMedia:view.banner};return out;}

async function processProfileMedia(source,usage){
    if(!Buffer.isBuffer(source.buffer)||!source.buffer.length)throw clientError('Arquivo vazio ou inválido.');
    const mime=String(source.mime||'').toLowerCase(),ext=path.extname(source.name||'').toLowerCase();
    let metadata=null;try{metadata=await sharp(source.buffer,{animated:true,failOn:'none',limitInputPixels:50_000_000}).metadata();}catch{}
    const animatedImage=metadata && ((metadata.format==='gif') || (Number(metadata.pages||1)>1));
    const videoLike=mime.startsWith('video/')||VIDEO_EXTENSIONS.has(ext)||animatedImage||mime==='image/gif'||ext==='.gif';
    if(videoLike)return transcodeVideo(source);
    if(!metadata||!new Set(['jpeg','png','webp','gif']).has(metadata.format))throw clientError('Formato não suportado. Use JPG, PNG, WEBP, GIF, MP4, WebM ou MOV.');
    if(!metadata.width||!metadata.height||metadata.width*metadata.height>50_000_000)throw clientError('As dimensões da imagem são muito grandes.');
    const max=usage==='banner'?1920:1024;
    const buffer=await sharp(source.buffer,{failOn:'error',limitInputPixels:50_000_000}).rotate().resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).webp({quality:86,effort:4}).toBuffer();
    if(buffer.length>MAX_OUTPUT_MB*1024*1024)throw clientError(`A mídia processada ultrapassa ${MAX_OUTPUT_MB}MB.`);
    return{kind:'image',mime:'image/webp',extension:'webp',buffer,posterBuffer:null};
}

async function transcodeVideo(source){
    if(!ffmpegPath)throw clientError('Conversão de vídeo indisponível neste servidor.',503);
    const token=`skynet-profile-${process.pid}-${randomId()}`;const inputExt=safeTempExtension(source.name,source.mime);const input=path.join(os.tmpdir(),`${token}${inputExt}`),output=path.join(os.tmpdir(),`${token}.mp4`),poster=path.join(os.tmpdir(),`${token}.jpg`);
    try{
        fs.writeFileSync(input,source.buffer,{mode:0o600});
        const scale='scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2';
        await execFileAsync(ffmpegPath,['-hide_banner','-loglevel','error','-y','-i',input,'-t',String(MAX_DURATION_SECONDS),'-an','-vf',scale,'-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',output],{timeout:45000,maxBuffer:1024*1024});
        await execFileAsync(ffmpegPath,['-hide_banner','-loglevel','error','-y','-i',output,'-frames:v','1','-vf','scale=w=min(720\\,iw):h=min(720\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-q:v','3',poster],{timeout:15000,maxBuffer:1024*1024});
        const buffer=fs.readFileSync(output),posterBuffer=fs.readFileSync(poster);
        if(!buffer.length)throw clientError('Não foi possível processar o vídeo.');
        if(buffer.length>MAX_OUTPUT_MB*1024*1024)throw clientError(`O vídeo processado ultrapassa ${MAX_OUTPUT_MB}MB.`);
        return{kind:'video',mime:'video/mp4',extension:'mp4',buffer,posterBuffer};
    }catch(error){if(error.statusCode)throw error;throw clientError('Não foi possível converter essa mídia. Verifique se o arquivo é um vídeo/GIF válido.');}
    finally{for(const file of[input,output,poster])try{fs.unlinkSync(file);}catch{}}
}

async function fetchRemoteMedia(urlValue){
    let current;try{current=new URL(urlValue);}catch{throw clientError('URL inválida.');}
    if(!['http:','https:'].includes(current.protocol))throw clientError('Apenas URLs HTTP/HTTPS são permitidas.');
    for(let redirects=0;redirects<=3;redirects++){
        await assertPublicHostname(current.hostname);const Client=current.protocol==='https:'?https:http;
        const response=await axios.get(current.toString(),{responseType:'arraybuffer',timeout:10000,maxRedirects:0,validateStatus:s=>(s>=200&&s<300)||(s>=300&&s<400),maxContentLength:MAX_SOURCE_MB*1024*1024,maxBodyLength:MAX_SOURCE_MB*1024*1024,headers:{'User-Agent':'SkyNetApi-ProfileMedia/1.0'},httpAgent:current.protocol==='http:'?new Client.Agent({keepAlive:false,lookup:safeLookup}):undefined,httpsAgent:current.protocol==='https:'?new Client.Agent({keepAlive:false,lookup:safeLookup}):undefined});
        if(response.status>=300&&response.status<400){if(!response.headers.location)throw clientError('Redirecionamento remoto inválido.');current=new URL(response.headers.location,current);if(!['http:','https:'].includes(current.protocol))throw clientError('Redirecionamento para protocolo não permitido.');continue;}
        const buffer=Buffer.from(response.data);if(buffer.length>MAX_SOURCE_MB*1024*1024)throw clientError(`A mídia remota ultrapassa ${MAX_SOURCE_MB}MB.`);
        const mime=String(response.headers['content-type']||'').split(';')[0].trim().toLowerCase();
        if(mime&&!mime.startsWith('image/')&&!mime.startsWith('video/')&&!mime.includes('octet-stream'))throw clientError('A URL não retornou uma imagem ou vídeo compatível.');
        return{buffer,mime,name:safeName(path.basename(current.pathname)||'midia')};
    }
    throw clientError('A URL excedeu o limite de redirecionamentos.');
}

function serveMedia(req,res,poster){const state=loadState(),record=state.records.find(r=>r.id===req.params.id);if(!record)return res.status(404).end();const filename=poster?record.posterFilename:record.filename;if(!filename)return res.status(404).end();const filepath=path.join(C.UPLOADS_DIR,path.basename(filename));if(!fs.existsSync(filepath))return res.status(404).end();res.setHeader('Cache-Control','public, max-age=3600');res.setHeader('Content-Type',poster?'image/jpeg':record.mime);if(record.kind==='video'&&!poster)res.setHeader('Accept-Ranges','bytes');return res.sendFile(filepath);}
function publicMedia(record){return record?{id:record.id,usage:record.usage,kind:record.kind,mime:record.mime,url:`/profile-media/${encodeURIComponent(record.id)}`,posterUrl:record.posterFilename?`/profile-media/${encodeURIComponent(record.id)}/poster`:null,sourceName:record.sourceName,createdAt:record.createdAt,maxDuration:record.maxDuration||null}:null;}
function selectionView(accountId,provided=null){const state=provided||loadState(),sel=state.selections.find(s=>s.accountId===accountId)||{};const avatar=state.records.find(r=>r.id===sel.avatarMediaId&&r.accountId===accountId),banner=state.records.find(r=>r.id===sel.bannerMediaId&&r.accountId===accountId);return{avatar:publicMedia(avatar),banner:publicMedia(banner)};}
function ensureSelection(state,accountId){let s=state.selections.find(v=>v.accountId===accountId);if(!s){s={accountId,avatarMediaId:'',bannerMediaId:'',updatedAt:null};state.selections.push(s);}return s;}
function pruneAccountRecords(state,accountId){const selected=ensureSelection(state,accountId),keepIds=new Set([selected.avatarMediaId,selected.bannerMediaId].filter(Boolean));const own=state.records.filter(r=>r.accountId===accountId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));for(const record of own.slice(8)){if(keepIds.has(record.id))continue;removeRecordFiles(record);state.records=state.records.filter(r=>r.id!==record.id);}}
function removeRecordFiles(record){for(const filename of[record?.filename,record?.posterFilename].filter(Boolean))try{fs.unlinkSync(path.join(C.UPLOADS_DIR,path.basename(filename)));}catch(error){if(error.code!=='ENOENT')console.error('Falha ao remover mídia de perfil:',error.message);}}

function ensureStorage(){fs.mkdirSync(C.DATA_DIR,{recursive:true});fs.mkdirSync(C.UPLOADS_DIR,{recursive:true});if(!fs.existsSync(MEDIA_FILE))writeJsonAtomic({records:[],selections:[]});}
function loadState(){ensureStorage();try{const v=JSON.parse(fs.readFileSync(MEDIA_FILE,'utf8'));return{records:Array.isArray(v.records)?v.records:[],selections:Array.isArray(v.selections)?v.selections:[]};}catch{return{records:[],selections:[]};}}
function saveState(state){writeJsonAtomic(state);}
function writeJsonAtomic(value){const temp=`${MEDIA_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(temp,MEDIA_FILE);}
function cleanupProfileMediaAccount(accountId){const state=loadState();for(const r of state.records.filter(r=>r.accountId===accountId))removeRecordFiles(r);state.records=state.records.filter(r=>r.accountId!==accountId);state.selections=state.selections.filter(s=>s.accountId!==accountId);saveState(state);}

function normalizeUsage(value){return['avatar','banner'].includes(String(value||'').toLowerCase())?String(value).toLowerCase():'';}
function safeName(value){return path.basename(String(value||'midia')).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,120)||'midia';}
function safeTempExtension(name,mime){const ext=path.extname(name||'').toLowerCase();if(/^\.[a-z0-9]{1,5}$/.test(ext))return ext;if(mime==='image/gif')return'.gif';if(mime==='video/webm')return'.webm';if(mime==='video/quicktime')return'.mov';return'.mp4';}
function clientError(message,statusCode=400){const e=new Error(message);e.statusCode=statusCode;return e;}
function randomId(){return crypto.randomBytes(12).toString('hex');}
function accountIdByUsername(username){const u=S.normalizeUsername(username);return S.loadAccounts().find(a=>a.active&&S.normalizeUsername(a.usernameLower||a.username)===u)?.id||null;}

function requireSession(req,res,next){try{const id=sessionAccountId(req),account=id?S.loadAccounts().find(a=>a.id===id&&a.active):null;if(!account)return res.status(401).json({ok:false,error:'Não autorizado.'});req.account=account;return next();}catch(error){return next(error);}}
function requireTrustedOrigin(req,res,next){const origin=req.get('origin');if(!origin)return next();const own=`${req.protocol}://${req.get('host')}`;if(origin===own||C.CORS_ORIGINS.has(origin))return next();return res.status(403).json({ok:false,error:'Origem não permitida.'});}
function sessionAccountId(req){const token=parseCookies(req.headers.cookie||'').skynet_session||'';return token?S.getSession(token)?.accountId||null:null;}
function parseCookies(header){const out={};for(const p of String(header||'').split(';')){const i=p.indexOf('=');if(i<0)continue;const k=p.slice(0,i).trim(),v=p.slice(i+1).trim();try{out[k]=decodeURIComponent(v);}catch{out[k]=v;}}return out;}

function safeLookup(hostname,options,callback){const opts=typeof options==='object'&&options?options:{};dns.lookup(hostname,{...opts,all:true,verbatim:true},(error,addresses)=>{if(error)return callback(error);const list=Array.isArray(addresses)?addresses:[addresses],allowed=list.filter(a=>a?.address&&!isPrivateIp(a.address));if(!allowed.length)return callback(new Error('Destino de rede não permitido'));if(opts.all)return callback(null,allowed);return callback(null,allowed[0].address,allowed[0].family);});}
async function assertPublicHostname(hostname){if(!hostname)throw clientError('Hostname inválido.');const stripped=hostname.replace(/^\[|\]$/g,'');if(net.isIP(stripped)){if(isPrivateIp(stripped))throw clientError('Endereços de rede interna não são permitidos.');return;}const addresses=await dns.promises.lookup(stripped,{all:true,verbatim:true});if(!addresses.length||addresses.some(a=>isPrivateIp(a.address)))throw clientError('A URL aponta para uma rede não permitida.');}
function isPrivateIp(address){const v=String(address||'').toLowerCase();if(!v)return true;if(v.startsWith('::ffff:'))return isPrivateIp(v.slice(7));if(net.isIPv6(v))return v==='::'||v==='::1'||v.startsWith('fc')||v.startsWith('fd')||/^fe[89ab]/.test(v);if(!net.isIPv4(v))return true;const[a,b]=v.split('.').map(Number);if(a===0||a===10||a===127||a>=224)return true;if(a===100&&b>=64&&b<=127)return true;if(a===169&&b===254)return true;if(a===172&&b>=16&&b<=31)return true;if(a===192&&b===168)return true;if(a===198&&(b===18||b===19))return true;return false;}

module.exports={registerProfileMediaRoutes,cleanupProfileMediaAccount,selectionView};

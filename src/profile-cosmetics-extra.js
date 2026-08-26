const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');
const { getXpView } = require('./xp-admin');

const EXTRA_FILE = path.join(C.DATA_DIR, 'profile-store-social-pack.json');
const BASE_STORE_FILE = path.join(C.DATA_DIR, 'profile-store.json');
const STARTER_COINS = 120;
const XP_PER_COIN = 10;

const FRAME_SPECS = [
 ['orbit-status','Orbit Status',2600,['#5865f2','#b5bac1'],true],['holo-presence','Holo Presence',2850,['#57f287','#5865f2'],true],['voice-pulse','Voice Pulse',3000,['#23a55a','#57f287'],true],['comet-ring','Comet Ring',3200,['#00a8fc','#ffffff'],true],['nitro-spectrum','Spectrum Boost',3450,['#eb459e','#5865f2'],true],['sound-wave','Sound Wave',3650,['#fee75c','#5865f2'],true],['pixel-glitch','Pixel Glitch',3900,['#ed4245','#00a8fc'],true],['spark-party','Spark Party',4100,['#fee75c','#eb459e'],true],['nebula-status','Nebula Status',4350,['#9b84ee','#5865f2'],true],['radar-ring','Radar Ring',4550,['#57f287','#00a8fc'],true],
 ['blurple-ring','Blurple Ring',1700,['#5865f2','#7983f5'],false],['mint-ring','Mint Ring',1750,['#57f287','#23a55a'],false],['sunset-ring','Sunset Ring',1850,['#f0b232','#eb459e'],false],['ice-ring','Ice Ring',1950,['#00a8fc','#d9f5ff'],false],['onyx-ring','Onyx Ring',2050,['#1e1f22','#80848e'],false],['lavender-ring','Lavender Ring',2150,['#b9a7ff','#7767d7'],false],['peach-ring','Peach Ring',2250,['#f7a68a','#ffd1c3'],false],['aqua-ring','Aqua Ring',2350,['#1abc9c','#70e1d4'],false],['rose-ring','Rose Ring',2450,['#eb459e','#ff9bc7'],false],['gold-ring','Gold Ring',2550,['#f0b232','#fee75c'],false],['slate-ring','Slate Ring',2650,['#4e5058','#b5bac1'],false],['cloud-ring','Cloud Ring',2750,['#f2f3f5','#949ba4'],false],['circuit-ring','Circuit Ring',2850,['#00a8fc','#5865f2'],false],['carbon-ring','Carbon Ring',2950,['#2b2d31','#6d6f78'],false],['pastel-ring','Pastel Ring',3050,['#b8a7ff','#ffb8d7'],false]
];
const DECO_SPECS = [
 ['confetti-live','Confetti Live',2600,['#fee75c','#eb459e'],true],['orbit-presence','Presence Orbits',2850,['#5865f2','#57f287'],true],['voice-wave','Voice Wave',3000,['#57f287','#00a8fc'],true],['sparkles-live','Live Sparkles',3200,['#ffffff','#b9a7ff'],true],['constellation-live','Constellation',3450,['#00a8fc','#b9a7ff'],true],['activity-pulse','Activity Pulse',3650,['#57f287','#5865f2'],true],['glitch-live','Status Glitch',3900,['#ed4245','#00a8fc'],true],['hearts-live','Heart Pop',4100,['#eb459e','#ffb8d7'],true],['bubbles-live','Bubble Chat',4350,['#00a8fc','#5865f2'],true],['comets-live','Comet Trails',4550,['#fee75c','#b9a7ff'],true],
 ['blurple-grid','Blurple Grid',1700,['#5865f2','#2b2d31'],false],['presence-dots','Presence Dots',1750,['#57f287','#949ba4'],false],['tiny-stars','Tiny Stars',1850,['#f2f3f5','#5865f2'],false],['corner-brackets','Corner Brackets',1950,['#b5bac1','#5865f2'],false],['sticker-wall','Sticker Wall',2050,['#fee75c','#eb459e'],false],['profile-banner','Profile Banner',2150,['#5865f2','#1e1f22'],false],['message-pins','Message Pins',2250,['#f0b232','#b5bac1'],false],['pixel-field','Pixel Field',2350,['#00a8fc','#5865f2'],false],['soft-clouds','Soft Clouds',2450,['#f2f3f5','#b9a7ff'],false],['badge-stack','Badge Stack',2550,['#57f287','#5865f2'],false],['cross-pattern','Cross Pattern',2650,['#949ba4','#5865f2'],false],['ribbon-strip','Ribbon Strip',2750,['#eb459e','#5865f2'],false],['panel-lines','Panel Lines',2850,['#4e5058','#b5bac1'],false],['scanline-static','Static Scanlines',2950,['#00a8fc','#1e1f22'],false],['snowflake-static','Snowflake Field',3050,['#d9f5ff','#5865f2'],false]
];
const EXTRA_CATALOG = Object.freeze([
 ...FRAME_SPECS.map(([id,name,price,colors,animated]) => item(`frame-social-${id}`,'frame',name,price,colors,animated,true)),
 ...DECO_SPECS.map(([id,name,price,colors,animated]) => item(`deco-social-${id}`,'decoration',name,price,colors,animated,false))
]);
const EXTRA_MAP = new Map(EXTRA_CATALOG.map(entry => [entry.id, entry]));

function item(id,type,name,price,colors,animated,overlay){return Object.freeze({id,type,name,price,rarity:animated?'legendary':'epic',colors,collection:'social',grantOnly:false,animated:Boolean(animated),overlay:Boolean(overlay)});}

function registerExtraProfileCosmetics(app) {
 ensureStorage();
 const json = express.json({ limit:'96kb' });
 app.use('/api/profile-store', json);

 app.post('/api/profile-store/buy/:itemId', requireTrustedOrigin, requireSession, (req,res,next) => {
   const product = EXTRA_MAP.get(cleanId(req.params.itemId));
   if (!product) return next();
   const state = getExtraState(req.account.id);
   if (state.ownedItems.some(e => e.itemId === product.id)) return res.status(409).json({ok:false,error:'Este item já pertence à sua conta.'});
   const base = getBaseState(req.account.id);
   const wallet = walletView(req.account.id, base);
   if (wallet.balance < product.price) return res.status(409).json({ok:false,error:`Saldo insuficiente. Faltam ${product.price-wallet.balance} moedas.`});
   state.ownedItems.push({itemId:product.id,price:product.price,purchasedAt:new Date().toISOString(),source:'store-social'});
   state.updatedAt = new Date().toISOString(); saveExtraState(state);
   base.spentCoins = Math.max(0,Number(base.spentCoins||0)) + product.price; base.updatedAt = new Date().toISOString(); saveBaseState(base);
   const payload = decoratePrivate({ok:true,purchased:product,wallet:walletView(req.account.id,base),inventory:[],equipped:{},cosmetics:{},catalog:[]}, req.account.id);
   return res.status(201).json(payload);
 });

 app.patch('/api/profile-store/equipped', requireTrustedOrigin, requireSession, (req,res,next) => {
   const originalFrame = cleanId(req.body?.frameId), originalDeco = cleanId(req.body?.decorationId);
   const frameExtra = EXTRA_MAP.get(originalFrame)?.type === 'frame' ? originalFrame : '';
   const decoExtra = EXTRA_MAP.get(originalDeco)?.type === 'decoration' ? originalDeco : '';
   if (frameExtra) req.body.frameId = '';
   if (decoExtra) req.body.decorationId = '';
   const originalJson = res.json.bind(res);
   res.json = payload => {
     if (res.statusCode < 400 && payload?.ok) {
       const state = getExtraState(req.account.id), owned = new Set(state.ownedItems.map(e=>e.itemId));
       if (Object.prototype.hasOwnProperty.call(req.body||{},'frameId')) state.equipped.frameId = frameExtra && owned.has(frameExtra) ? frameExtra : '';
       if (Object.prototype.hasOwnProperty.call(req.body||{},'decorationId')) state.equipped.decorationId = decoExtra && owned.has(decoExtra) ? decoExtra : '';
       state.updatedAt = new Date().toISOString(); saveExtraState(state);
       payload = decoratePrivate(payload, req.account.id);
     }
     return originalJson(payload);
   };
   return next();
 });

 app.use((req,res,next) => {
   const pathName = req.path;
   const isCatalog = req.method==='GET' && pathName==='/api/profile-store/catalog';
   const isMe = req.method==='GET' && pathName==='/api/profile-store/me';
   const isPublicProfile = req.method==='GET' && pathName.startsWith('/api/profile-v3/profile/');
   const isLeaderboard = req.method==='GET' && pathName==='/api/profile-v3/leaderboard';
   if (!isCatalog && !isMe && !isPublicProfile && !isLeaderboard) return next();
   const originalJson=res.json.bind(res);
   res.json=payload=>{
     if (payload?.ok) {
       if (isCatalog) payload={...payload,catalog:mergeCatalog(payload.catalog)};
       else if (isMe) { const accountId=sessionAccountId(req); if(accountId) payload=decoratePrivate(payload,accountId); }
       else if (isPublicProfile && payload.profile?.id) payload={...payload,profile:decoratePublicProfile(payload.profile,payload.profile.id)};
       else if (isLeaderboard && Array.isArray(payload.leaderboard)) payload={...payload,leaderboard:payload.leaderboard.map(row=>decoratePublicProfile(row,row.id))};
     }
     return originalJson(payload);
   };
   return next();
 });
}

function decoratePrivate(payload,accountId){
 const state=getExtraState(accountId), owned=state.ownedItems.map(e=>({...e,item:EXTRA_MAP.get(e.itemId)})).filter(e=>e.item);
 const frame=state.equipped.frameId?EXTRA_MAP.get(state.equipped.frameId):null, deco=state.equipped.decorationId?EXTRA_MAP.get(state.equipped.decorationId):null;
 return {...payload,inventory:[...(payload.inventory||[]),...owned],catalog:mergeCatalog(payload.catalog),equipped:{...(payload.equipped||{}),frameId:frame?.id||(payload.equipped?.frameId||''),decorationId:deco?.id||(payload.equipped?.decorationId||'')},cosmetics:{...(payload.cosmetics||{}),frame:frame||(payload.cosmetics?.frame||null),decoration:deco||(payload.cosmetics?.decoration||null)}};
}
function decoratePublicProfile(profile,accountId){const state=getExtraState(accountId),frame=state.equipped.frameId?EXTRA_MAP.get(state.equipped.frameId):null,deco=state.equipped.decorationId?EXTRA_MAP.get(state.equipped.decorationId):null;if(!frame&&!deco)return profile;return{...profile,cosmetics:{...(profile.cosmetics||{}),frame:frame||(profile.cosmetics?.frame||null),decoration:deco||(profile.cosmetics?.decoration||null)}};}
function mergeCatalog(base){const seen=new Set((base||[]).map(i=>i.id));return[...(base||[]),...EXTRA_CATALOG.filter(i=>!seen.has(i.id))];}

function ensureStorage(){fs.mkdirSync(C.DATA_DIR,{recursive:true});if(!fs.existsSync(EXTRA_FILE))writeJsonAtomic(EXTRA_FILE,[]);if(!fs.existsSync(BASE_STORE_FILE))writeJsonAtomic(BASE_STORE_FILE,[]);}
function loadExtraStates(){ensureStorage();try{const v=JSON.parse(fs.readFileSync(EXTRA_FILE,'utf8'));return Array.isArray(v)?v:[];}catch{return[];}}
function getExtraState(accountId){const found=loadExtraStates().find(s=>s.accountId===accountId)||{};const ownedItems=(Array.isArray(found.ownedItems)?found.ownedItems:[]).filter(e=>EXTRA_MAP.has(e.itemId));const owned=new Set(ownedItems.map(e=>e.itemId));const f=cleanId(found.equipped?.frameId),d=cleanId(found.equipped?.decorationId);return{accountId,ownedItems,equipped:{frameId:owned.has(f)&&EXTRA_MAP.get(f)?.type==='frame'?f:'',decorationId:owned.has(d)&&EXTRA_MAP.get(d)?.type==='decoration'?d:''},updatedAt:found.updatedAt||null};}
function saveExtraState(state){const all=loadExtraStates(),i=all.findIndex(s=>s.accountId===state.accountId);if(i<0)all.push(state);else all[i]=state;writeJsonAtomic(EXTRA_FILE,all);}
function loadBaseStates(){ensureStorage();try{const v=JSON.parse(fs.readFileSync(BASE_STORE_FILE,'utf8'));return Array.isArray(v)?v:[];}catch{return[];}}
function getBaseState(accountId){const found=loadBaseStates().find(s=>s.accountId===accountId)||{};return{...found,accountId,ownedItems:Array.isArray(found.ownedItems)?found.ownedItems:[],spentCoins:Math.max(0,Number(found.spentCoins||0)),bonusCoins:Number(found.bonusCoins||0),equipped:found.equipped&&typeof found.equipped==='object'?found.equipped:{tagIds:[],frameId:'',decorationId:''},updatedAt:found.updatedAt||null};}
function saveBaseState(state){const all=loadBaseStates(),i=all.findIndex(s=>s.accountId===state.accountId);if(i<0)all.push(state);else all[i]=state;writeJsonAtomic(BASE_STORE_FILE,all);}
function walletView(accountId,base){const xp=getXpView(accountId),earnedCoins=STARTER_COINS+Math.floor(Number(xp.totalXp||0)/XP_PER_COIN),bonusCoins=Number(base.bonusCoins||0),spentCoins=Math.max(0,Number(base.spentCoins||0));return{balance:Math.max(0,earnedCoins+bonusCoins-spentCoins),earnedCoins,bonusCoins,spentCoins,starterCoins:STARTER_COINS,xpPerCoin:XP_PER_COIN};}
function cleanupExtraProfileCosmeticsAccount(accountId){writeJsonAtomic(EXTRA_FILE,loadExtraStates().filter(s=>s.accountId!==accountId));}
function writeJsonAtomic(file,value){const temp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(temp,file);}

function requireSession(req,res,next){try{const id=sessionAccountId(req);const account=id?S.loadAccounts().find(a=>a.id===id&&a.active):null;if(!account)return res.status(401).json({ok:false,error:'Não autorizado.'});req.account=account;return next();}catch(e){return next(e);}}
function requireTrustedOrigin(req,res,next){const origin=req.get('origin');if(!origin)return next();const own=`${req.protocol}://${req.get('host')}`;if(origin===own||C.CORS_ORIGINS.has(origin))return next();return res.status(403).json({ok:false,error:'Origem não permitida.'});}
function sessionAccountId(req){const token=parseCookies(req.headers.cookie||'').skynet_session||'';return token?S.getSession(token)?.accountId||null:null;}
function parseCookies(header){const out={};for(const p of String(header||'').split(';')){const i=p.indexOf('=');if(i<0)continue;const k=p.slice(0,i).trim(),v=p.slice(i+1).trim();try{out[k]=decodeURIComponent(v);}catch{out[k]=v;}}return out;}
function cleanId(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,100);}

module.exports={registerExtraProfileCosmetics,cleanupExtraProfileCosmeticsAccount,EXTRA_CATALOG};

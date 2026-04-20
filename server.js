const http=require('http'),https=require('https');
const nodemailer=require('nodemailer');

const VK=process.env.VAPI_KEY||'74b7b21d-f286-4a56-b1ac-2bf37a91d088';
const ASSISTANT_ID='133aa70c-db4b-4155-be6b-220450c0b21a';
const PHONE_NUMBER_ID='97bf7ebd-d04c-4faa-b897-5ade6c02ea3a';
const SK=process.env.SB_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3luc3h1a214anF1b3FjYmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjExMzQwMCwiZXhwIjoyMDkxNjg5NDAwfQ.33AsVo1mIeNHznTKnr6IUjVTLP_puNeNFJMS8-GsO30';
const TWILIO_SID=process.env.TWILIO_SID,TWILIO_TOKEN=process.env.TWILIO_TOKEN;
const GMAIL_USER=process.env.GMAIL_USER||'';
const GMAIL_APP_PASSWORD=process.env.GMAIL_APP_PASSWORD||'';
const EXPERT_EMAIL=process.env.EXPERT_EMAIL||'yigittatarli23@gmail.com';
const ADMIN_WA='whatsapp:+38267670828',FROM_WA='whatsapp:+14155238886';
const CRM_BASE='https://myshoppingcarttr-cyber.github.io/tradebot-crm/?v=71';

const STAFF_EMAIL_MAP=(process.env.STAFF_EMAILS||'').split(',').reduce((acc,p)=>{
  const[id,em]=p.split(':');if(id&&em)acc[id.trim()]=em.trim();return acc;
},{});

let gmailTransporter=null;
if(GMAIL_USER&&GMAIL_APP_PASSWORD){
  gmailTransporter=nodemailer.createTransport({
    service:'gmail',
    auth:{user:GMAIL_USER,pass:GMAIL_APP_PASSWORD.replace(/\s/g,'')}
  });
  gmailTransporter.verify((err)=>{
    if(err)console.error('Gmail SMTP ERROR:',err.message);
    else console.log('Gmail SMTP ready');
  });
}

function req(opts,body){return new Promise((res,rej)=>{const r=https.request(opts,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}})});r.on('error',rej);if(body)r.write(typeof body==='string'?body:JSON.stringify(body));r.end()});}
function sb(method,path,body){const p=body?JSON.stringify(body):null;return req({hostname:'muwynsxukmxjquoqcbac.supabase.co',path:'/rest/v1/'+path,method,headers:{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':method==='POST'||method==='PATCH'?'return=representation':'return=minimal',...(p?{'Content-Length':Buffer.byteLength(p)}:{})}},p);}
function vapi(method,path,body){const p=body?JSON.stringify(body):null;return req({hostname:'api.vapi.ai',path:'/'+path,method,headers:{'Authorization':'Bearer '+VK,'Content-Type':'application/json',...(p?{'Content-Length':Buffer.byteLength(p)}:{})}},p);}
function wa(to,text){if(!TWILIO_SID)return Promise.resolve();const auth=Buffer.from(TWILIO_SID+':'+TWILIO_TOKEN).toString('base64');const pd='To='+encodeURIComponent(to)+'&From='+encodeURIComponent(FROM_WA)+'&Body='+encodeURIComponent(text);return req({hostname:'api.twilio.com',path:'/2010-04-01/Accounts/'+TWILIO_SID+'/Messages.json',method:'POST',headers:{'Authorization':'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(pd)}},pd);}

async function sendEmail(to,subject,html){
  if(!gmailTransporter)return null;
  try{
    const info=await gmailTransporter.sendMail({
      from:'"Global Exbina - AyÅe AI" <'+GMAIL_USER+'>',
      to,subject,html
    });
    console.log('Email sent to',to);
    return info;
  }catch(e){console.error('Gmail err:',e.message);return null;}
}

function genLeadCode(){return 'LEAD-'+Math.floor(1000+Math.random()*9000);}

// Phone normalize - hem DB format (10 haneli) hem VAPI format (+90...) iÃ§in
function normPhone(raw){
  if(!raw)return'';
  let p=(''+raw).replace(/[^\d+]/g,'');
  if(p.startsWith('00'))p='+'+p.slice(2);
  if(!p.startsWith('+')){
    if(p.startsWith('90')&&p.length===12)p='+'+p;
    else if(p.startsWith('0')&&p.length===11)p='+9'+p;
    else if(p.length===10&&p.startsWith('5'))p='+90'+p;
    else p='+'+p;
  }
  return p;
}

// === FOREX / CRYPTO / COMMODITIES API â Ã¼cretsiz, cache'li ===
let priceCache={data:null,time:0};
const CACHE_MS=60000; // 1 dakika cache

async function getLivePrices(){
  if(priceCache.data && Date.now()-priceCache.time < CACHE_MS){
    return priceCache.data;
  }
  const prices={};
  try{
    // AltÄ±n + GÃ¼mÃ¼Å + Brent: metals-api (tier-free) veya fallback
    // 1. Gold price API (aÃ§Ä±k, rate-limit yok)
    const goldR=await req({hostname:'api.gold-api.com',path:'/price/XAU',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(goldR?.price)prices.gold_usd=parseFloat(goldR.price).toFixed(2);
    
    // 2. Silver
    const silverR=await req({hostname:'api.gold-api.com',path:'/price/XAG',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(silverR?.price)prices.silver_usd=parseFloat(silverR.price).toFixed(2);
    
    // 3. Bitcoin - Coingecko (Ã¼cretsiz, rate-limit yumuÅak)
    const cgR=await req({hostname:'api.coingecko.com',path:'/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(cgR?.bitcoin?.usd)prices.btc_usd=cgR.bitcoin.usd;
    if(cgR?.ethereum?.usd)prices.eth_usd=cgR.ethereum.usd;
    
    // 4. Forex (EURUSD, GBPUSD, USDTRY) - exchangerate-api (Ã¼cretsiz)
    const fxR=await req({hostname:'open.er-api.com',path:'/v6/latest/USD',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(fxR?.rates){
      prices.eurusd=(1/fxR.rates.EUR).toFixed(4);
      prices.gbpusd=(1/fxR.rates.GBP).toFixed(4);
      prices.usdtry=fxR.rates.TRY?.toFixed(2);
    }
    
    prices.updated_at=new Date().toISOString();
    priceCache={data:prices,time:Date.now()};
    return prices;
  }catch(e){
    console.error('Price fetch err:',e.message);
    return priceCache.data||{error:'unavailable'};
  }
}

// AyÅe iÃ§in okunabilir fiyat metni Ã¼ret
function formatPricesForAyse(p){
  if(!p||p.error)return 'Åu an fiyat bilgisi alamÄ±yorum, uzmanÄ±mÄ±z gÃ¶rÃ¼Åmede size gÃ¼ncel rakamlarÄ± verecek';
  const lines=[];
  if(p.gold_usd)lines.push('altÄ±n '+p.gold_usd+' dolar');
  if(p.btc_usd)lines.push('bitcoin '+Math.round(p.btc_usd).toLocaleString('tr-TR')+' dolar');
  if(p.eurusd)lines.push('euro dolar paritesi '+p.eurusd);
  if(p.usdtry)lines.push('dolar '+p.usdtry+' lira');
  return 'Åu an canlÄ± piyasada: '+lines.join(', ');
}

function buildEmailHtml(lead,forStaff=false){
  const MODEL={demo_only:'1 ay Ã¼cretsiz demo',demo_plus_investment:'Demo + 3000 USD + %20 bonus',undecided:'KararsÄ±z'};
  const INT={high:'ð¢ YÃKSEK',medium:'ð¡ ORTA',low:'ð´ DÃÅÃK'};
  const CHAN={phone:'ð Telefon',whatsapp:'ð¬ WhatsApp',email:'ð§ Email'};
  const crmLink=CRM_BASE+'&customer='+(lead.customer_id||'');
  const headerTxt=forStaff?'SÄ°ZE ATANAN YENÄ° LEAD':'SICAK LEAD BÄ°LDÄ°RÄ°MÄ°';
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f5f0">'+
    '<div style="background:#181418;padding:28px 24px;border-bottom:4px solid #C9A96E">'+
      '<div style="color:#C9A96E;font-size:22px;font-weight:900;letter-spacing:2px">GLOBAL EXBÄ°NA</div>'+
      '<div style="color:#7B6EA8;font-size:11px;letter-spacing:3px;margin-top:6px">'+headerTxt+'</div>'+
    '</div>'+
    '<div style="background:#fff;padding:24px">'+
      '<div style="background:#C9A96E;color:#181418;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:700;font-size:14px">'+(lead.lead_code||'â')+'</div>'+
      '<h2 style="color:#181418;margin:16px 0 4px;font-size:22px">'+(lead.full_name||'â')+'</h2>'+
      '<div style="color:#888;font-size:13px;margin-bottom:20px">'+(INT[lead.interest_level]||'')+' ilgi seviyesi</div>'+
      '<table style="width:100%;border-collapse:collapse;margin:16px 0">'+
        '<tr><td style="padding:10px 0;color:#666;width:150px;border-bottom:1px solid #eee">Telefon</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee"><a href="tel:'+(lead.phone||'')+'" style="color:#C9A96E;text-decoration:none">'+(lead.phone||'â')+'</a></td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">Randevu</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee">'+(lead.preferred_datetime||'â')+'</td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">Model</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee">'+(MODEL[lead.selected_model]||'â')+'</td></tr>'+
      '</table>'+
      '<div style="margin-top:28px;text-align:center"><a href="'+crmLink+'" style="display:inline-block;background:#C9A96E;color:#181418;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700">CRM\'DE AÃ â</a></div>'+
    '</div></div>';
}

async function pickNextAgent(){
  try{
    const agents=await sb('GET','users?role=eq.agent&is_active=eq.true&select=id,full_name');
    if(!Array.isArray(agents)||!agents.length)return null;
    const recent=await sb('GET','customers?source=eq.ayse_ai_call&order=created_at.desc&limit=20&select=assigned_to');
    const counts={};agents.forEach(a=>counts[a.id]=0);
    if(Array.isArray(recent))recent.forEach(c=>{if(c.assigned_to&&counts[c.assigned_to]!==undefined)counts[c.assigned_to]++;});
    let minCount=Infinity,selected=agents[0];
    agents.forEach(a=>{if(counts[a.id]<minCount){minCount=counts[a.id];selected=a;}});
    return selected;
  }catch(e){return null;}
}

async function handleSaveLead(args,callId){
  const lead_code=genLeadCode();
  const full_name=(args.full_name||'').trim();
  const phone=normPhone(args.phone);
  const MODELS={demo_only:'1 ay demo',demo_plus_investment:'Demo + 3000 USD + %20 bonus',undecided:'KararsÄ±z'};
  const INT={high:'YÃ¼ksek',medium:'Orta',low:'DÃ¼ÅÃ¼k'};
  const notesText=['['+lead_code+']','ð¤ AyÅe AI aramasÄ± ('+new Date().toLocaleString('tr-TR')+')','ð Randevu: '+(args.preferred_datetime||'-'),'ð¯ Model: '+(MODELS[args.selected_model]||'-'),'ð¥ Ä°lgi: '+(INT[args.interest_level]||'-'),args.objection?'â ï¸ Ä°tiraz: '+args.objection:'',args.notes?'ð '+args.notes:''].filter(Boolean).join('\n');
  let customer_id=null,assignedAgent=null;
  // Aramada kullanÄ±lan phone, DB'de 10 haneli form olabilir - her iki format ile ara
  const phoneVariants=[phone, phone.replace('+90',''), phone.replace('+','')];
  for(const pv of phoneVariants){
    const existing=await sb('GET','customers?phone=eq.'+encodeURIComponent(pv)+'&select=id,notes,assigned_to').catch(()=>null);
    if(Array.isArray(existing)&&existing[0]){
      customer_id=existing[0].id;
      const mergedNotes='['+lead_code+']\n'+notesText+(existing[0].notes?'\n\n--- Ãnceki ---\n'+existing[0].notes:'');
      if(existing[0].assigned_to){
        const agRow=await sb('GET','users?id=eq.'+existing[0].assigned_to+'&select=id,full_name').catch(()=>null);
        if(Array.isArray(agRow)&&agRow[0])assignedAgent=agRow[0];
      }else assignedAgent=await pickNextAgent();
      await sb('PATCH','customers?id=eq.'+customer_id,{notes:mergedNotes,status:'hot',score:95,interest:MODELS[args.selected_model]||args.selected_model,assigned_to:assignedAgent?.id||existing[0].assigned_to,updated_at:new Date().toISOString()}).catch(()=>{});
      break;
    }
  }
  if(!customer_id){
    assignedAgent=await pickNextAgent();
    const ins=await sb('POST','customers',{full_name,phone:phone.replace('+90','')||'unknown_'+Date.now(),country:'TR',status:'hot',score:95,source:'ayse_ai_call',interest:MODELS[args.selected_model]||null,notes:notesText,assigned_to:assignedAgent?.id||null}).catch(()=>null);
    if(Array.isArray(ins)&&ins[0])customer_id=ins[0].id;
  }
  if(callId){
    await sb('POST','calls',{vapi_call_id:callId,customer_id,agent_id:assignedAgent?.id||null,call_type:'outbound',status:'completed',outcome:'appointment_booked',randevu_alindi:true,skor:args.interest_level==='high'?90:args.interest_level==='medium'?60:30,ilgi_seviyesi:args.interest_level,itiraz:args.objection||null,satis_durumu:'appointment_requested',etiket:lead_code,notes:notesText}).catch(()=>{});
  }
  const emailData={lead_code,customer_id,full_name,phone,preferred_datetime:args.preferred_datetime,preferred_channel:args.preferred_channel,selected_model:args.selected_model,interest_level:args.interest_level,objection:args.objection,notes:args.notes};
  sendEmail(EXPERT_EMAIL,'ð¥ ['+lead_code+'] Yeni sÄ±cak lead: '+full_name,buildEmailHtml(emailData)).catch(()=>{});
  if(assignedAgent&&STAFF_EMAIL_MAP[assignedAgent.id]){
    sendEmail(STAFF_EMAIL_MAP[assignedAgent.id],'ð¥ ['+lead_code+'] Size atandÄ±: '+full_name,buildEmailHtml(emailData,true)).catch(()=>{});
  }
  wa(ADMIN_WA,'ð¥ LEAD '+lead_code+' '+full_name+' '+phone+' '+(MODELS[args.selected_model]||'-')).catch(()=>{});
  return lead_code;
}

async function handleRejection(args,callId){
  if(callId){
    await sb('POST','calls',{vapi_call_id:callId,call_type:'outbound',status:'completed',outcome:'rejected',randevu_alindi:false,satis_durumu:'lost',itiraz:args.reason||'unspecified',notes:args.notes||''}).catch(()=>{});
    try{
      const call=await vapi('GET','call/'+callId);
      const phone=call.customer?.number;
      if(phone){
        const phoneVars=[phone, phone.replace('+90',''), phone.replace('+','')];
        for(const pv of phoneVars){
          await sb('PATCH','customers?phone=eq.'+encodeURIComponent(pv),{status:args.reason==='do_not_call'?'blacklist':'ilgilenmedi',updated_at:new Date().toISOString()}).catch(()=>{});
        }
      }
    }catch(e){}
  }
  return 'logged';
}

async function syncCall(vapiCallId){
  try{
    const call=await vapi('GET','call/'+vapiCallId);
    if(!call||!call.id)return;
    const dur=call.startedAt&&call.endedAt?Math.round((new Date(call.endedAt)-new Date(call.startedAt))/1000):0;
    await sb('PATCH','calls?vapi_call_id=eq.'+vapiCallId,{duration_seconds:dur,summary:call.analysis?.summary||'',transcript:call.transcript||'',recording_url:call.recordingUrl||null}).catch(()=>{});
  }catch(e){}
}

async function makeCall(customer_id,phone_override){
  let customer=null;
  if(customer_id){
    const cr=await sb('GET','customers?id=eq.'+customer_id+'&select=*');
    if(Array.isArray(cr)&&cr[0])customer=cr[0];
  }
  const phone=normPhone(phone_override||customer?.phone);
  if(!phone||phone.length<10)return {error:'invalid_phone',phone};
  
  const result=await vapi('POST','call',{
    assistantId:ASSISTANT_ID,
    phoneNumberId:PHONE_NUMBER_ID,
    customer:{number:phone,name:customer?.full_name||'MÃ¼Återi'}
  });
  
  if(result?.id){
    await sb('POST','calls',{
      vapi_call_id:result.id,customer_id:customer?.id||null,call_type:'outbound',status:'initiated',
      notes:'ð¤ AyÅe AI outbound - '+new Date().toLocaleString('tr-TR')
    }).catch(()=>{});
    if(customer?.id){
      await sb('PATCH','customers?id=eq.'+customer.id,{status:'aranÄ±yor',last_contact:new Date().toISOString()}).catch(()=>{});
    }
    return {ok:true,call_id:result.id,phone,customer_name:customer?.full_name};
  }
  return {error:'vapi_failed',detail:result};
}

async function bulkCalls(params){
  const {filter={},limit=10,concurrent=2,delay_ms=3000}=params;
  const actualLimit=Math.min(limit,100);
  // Son 1 saatte aranmış olanları hariç tut
  const oneHourAgo=new Date(Date.now()-3600000).toISOString();
  let query='customers?select=id,full_name,phone,status,last_contact&limit='+actualLimit;
  if(filter.status)query+='&status=eq.'+encodeURIComponent(filter.status);
  // last_contact NULL olan (hiç aranmamış) veya 1 saatten eski arananlar
  query+='&or=(last_contact.is.null,last_contact.lt.'+encodeURIComponent(oneHourAgo)+')';
  // Önce NULL olanlar (hiç aranmamış), sonra en eski aranmış
  query+='&order=last_contact.asc.nullsfirst';
  const customers=await sb('GET',query);
  if(!Array.isArray(customers)||!customers.length)return {error:'no_customers_found'};
  const results=[];
  const queue=[...customers];
  const active=new Set();
  async function processOne(c){
    try{const r=await makeCall(c.id);results.push({customer_id:c.id,name:c.full_name,phone:c.phone,result:r});}
    catch(e){results.push({customer_id:c.id,error:e.message});}
    active.delete(c.id);
  }
  while(queue.length>0||active.size>0){
    while(active.size<concurrent&&queue.length>0){
      const c=queue.shift();active.add(c.id);processOne(c);
    }
    await new Promise(r=>setTimeout(r,delay_ms));
  }
  await new Promise(r=>setTimeout(r,2000));
  return {total_queued:customers.length,results};
}

const server=http.createServer((rq,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  res.setHeader('Content-Type','application/json');
  if(rq.method==='OPTIONS'){res.writeHead(200);res.end();return;}
  if(rq.method==='GET'){
    if(rq.url.startsWith('/call-status/')){
      const callId=rq.url.split('/call-status/')[1];
      vapi('GET','call/'+callId).then(c=>{
        res.writeHead(200);
        res.end(JSON.stringify({status:c.status,endedReason:c.endedReason,duration:c.startedAt&&c.endedAt?Math.round((new Date(c.endedAt)-new Date(c.startedAt))/1000):null,msgCount:(c.messages||[]).length,transcript:c.transcript?.substring(0,500),summary:c.analysis?.summary}));
      }).catch(()=>{res.writeHead(500);res.end('{}');});
      return;
    }
    if(rq.url==='/prices'){
      getLivePrices().then(p=>{res.writeHead(200);res.end(JSON.stringify(p));}).catch(e=>{res.writeHead(500);res.end(JSON.stringify({error:e.message}));});
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({status:'Ayse Server v5.4 - Prices + Outbound',endpoints:['/save-lead','/log-rejection','/vapi-webhook','/send-whatsapp','/send-email','/make-call','/bulk-call','/call-status/:id','/sync-call','/prices','/get-live-prices'],gmail_configured:!!gmailTransporter,phone_number:'+902128220416',time:new Date().toISOString()}));
    return;
  }
  if(rq.method==='POST'){
    let body='';
    rq.on('data',c=>body+=c);
    rq.on('end',async()=>{
      try{
        const data=JSON.parse(body||'{}');
        
        if(rq.url==='/save-lead'){
          const tool=data.message?.toolCallList?.[0]||data.message?.functionCall;
          const args=tool?.function?.arguments||tool?.arguments||data;
          const id=tool?.id||'x';
          const callId=data.message?.call?.id||data.call?.id;
          const parsedArgs=typeof args==='string'?JSON.parse(args):args;
          const leadCode=await handleSaveLead(parsedArgs,callId);
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:'KayÄ±t tamamlandÄ±. Referans kodunuz: '+leadCode}]}));
          return;
        }
        
        if(rq.url==='/log-rejection'){
          const tool=data.message?.toolCallList?.[0]||data.message?.functionCall;
          const args=tool?.function?.arguments||tool?.arguments||data;
          const id=tool?.id||'x';
          const callId=data.message?.call?.id||data.call?.id;
          const parsedArgs=typeof args==='string'?JSON.parse(args):args;
          await handleRejection(parsedArgs,callId);
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:'Red loglandÄ±'}]}));
          return;
        }
        
        // === NEW: VAPI tool endpoint - canlÄ± fiyatlar ===
        if(rq.url==='/get-live-prices'){
          const tool=data.message?.toolCallList?.[0]||data.message?.functionCall;
          const id=tool?.id||'x';
          const prices=await getLivePrices();
          const formatted=formatPricesForAyse(prices);
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:formatted}]}));
          return;
        }
        
        if(rq.url==='/send-email'){
          const{to,subject,html,text}=data;
          if(!to||!subject||(!html&&!text)){res.writeHead(400);res.end(JSON.stringify({error:'to, subject, html/text gerekli'}));return;}
          const result=await sendEmail(to,subject,html||text);
          res.writeHead(result?200:500);
          res.end(JSON.stringify({ok:!!result,messageId:result?.messageId}));
          return;
        }
        
        if(rq.url==='/make-call'){
          const{customer_id,phone}=data;
          const result=await makeCall(customer_id,phone);
          res.writeHead(result.ok?200:400);
          res.end(JSON.stringify(result));
          return;
        }
        
        if(rq.url==='/bulk-call'){
          bulkCalls(data).then(r=>console.log('Bulk done:',r.total_queued)).catch(e=>console.error('Bulk err:',e));
          res.writeHead(202);
          res.end(JSON.stringify({ok:true,message:'Bulk job started',filter:data.filter,limit:data.limit}));
          return;
        }
        
        if(rq.url==='/vapi-webhook'){
          const type=data.message?.type||data.type;
          const callId=data.message?.call?.id||data.call?.id||data.callId;
          if((type==='end-of-call-report'||type==='call.ended')&&callId){
            syncCall(callId).catch(()=>{});
          }
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        if(rq.url==='/sync-call'){
          if(data.vapi_call_id)syncCall(data.vapi_call_id).catch(()=>{});
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        res.writeHead(200);res.end(JSON.stringify({ok:true}));
      }catch(e){console.error('handler err',e.message);res.writeHead(500);res.end(JSON.stringify({err:e.message}));}
    });return;
  }
  res.writeHead(404);res.end('{}');
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Ayse Server v5.4 - Prices API ready - port '+PORT+' | Gmail:'+(gmailTransporter?'ON':'OFF')));
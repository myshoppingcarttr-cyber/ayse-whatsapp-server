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
      from:'"Global Exbina - Ayşe AI" <'+GMAIL_USER+'>',
      to,subject,html
    });
    console.log('Email sent to',to);
    return info;
  }catch(e){console.error('Gmail err:',e.message);return null;}
}

function genLeadCode(){return 'LEAD-'+Math.floor(1000+Math.random()*9000);}

// Phone normalize - iki format arası dönüşüm
function normPhoneE164(raw){
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

// DB format (10 haneli, başında 0/+ yok)
function normPhoneDB(raw){
  if(!raw)return'';
  let p=(''+raw).replace(/[^\d+]/g,'');
  if(p.startsWith('00'))p=p.slice(2);
  if(p.startsWith('+90'))p=p.slice(3);
  else if(p.startsWith('+'))p=p.slice(1);
  if(p.startsWith('90')&&p.length===12)p=p.slice(2);
  if(p.startsWith('0')&&p.length===11)p=p.slice(1);
  return p;
}

// Canlı fiyatlar cache
let priceCache={data:null,time:0};
const CACHE_MS=60000;

async function getLivePrices(){
  if(priceCache.data && Date.now()-priceCache.time < CACHE_MS){
    return priceCache.data;
  }
  const prices={};
  try{
    const goldR=await req({hostname:'api.gold-api.com',path:'/price/XAU',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(goldR?.price)prices.gold_usd=parseFloat(goldR.price).toFixed(2);
    const silverR=await req({hostname:'api.gold-api.com',path:'/price/XAG',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(silverR?.price)prices.silver_usd=parseFloat(silverR.price).toFixed(2);
    const cgR=await req({hostname:'api.coingecko.com',path:'/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',method:'GET',headers:{'User-Agent':'GlobalEksbina/1.0'}});
    if(cgR?.bitcoin?.usd)prices.btc_usd=cgR.bitcoin.usd;
    if(cgR?.ethereum?.usd)prices.eth_usd=cgR.ethereum.usd;
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

function formatPricesForAyse(p){
  if(!p||p.error)return 'Şu an fiyat bilgisi alamıyorum, uzmanımız görüşmede size güncel rakamları verecek';
  const lines=[];
  if(p.gold_usd)lines.push('altın '+p.gold_usd+' dolar');
  if(p.btc_usd)lines.push('bitcoin '+Math.round(p.btc_usd).toLocaleString('tr-TR')+' dolar');
  if(p.eurusd)lines.push('euro dolar paritesi '+p.eurusd);
  if(p.usdtry)lines.push('dolar '+p.usdtry+' lira');
  return 'Şu an canlı piyasada: '+lines.join(', ');
}

function buildEmailHtml(lead,forStaff=false){
  const MODEL={demo_only:'1 ay ücretsiz demo',demo_plus_investment:'Demo + 3000 USD + %20 bonus',undecided:'Kararsız'};
  const INT={high:'🟢 YÜKSEK',medium:'🟡 ORTA',low:'🔴 DÜŞÜK'};
  const crmLink=CRM_BASE+'&customer='+(lead.customer_id||'');
  const headerTxt=forStaff?'SİZE ATANAN YENİ LEAD':'SICAK LEAD BİLDİRİMİ';
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f5f0">'+
    '<div style="background:#181418;padding:28px 24px;border-bottom:4px solid #C9A96E">'+
      '<div style="color:#C9A96E;font-size:22px;font-weight:900;letter-spacing:2px">GLOBAL EXBİNA</div>'+
      '<div style="color:#7B6EA8;font-size:11px;letter-spacing:3px;margin-top:6px">'+headerTxt+'</div>'+
    '</div>'+
    '<div style="background:#fff;padding:24px">'+
      '<div style="background:#C9A96E;color:#181418;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:700;font-size:14px">'+(lead.lead_code||'—')+'</div>'+
      '<h2 style="color:#181418;margin:16px 0 4px;font-size:22px">'+(lead.full_name||'—')+'</h2>'+
      '<div style="color:#888;font-size:13px;margin-bottom:20px">'+(INT[lead.interest_level]||'')+' ilgi seviyesi</div>'+
      '<table style="width:100%;border-collapse:collapse;margin:16px 0">'+
        '<tr><td style="padding:10px 0;color:#666;width:150px;border-bottom:1px solid #eee">Telefon</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee"><a href="tel:'+(lead.phone||'')+'" style="color:#C9A96E;text-decoration:none">'+(lead.phone||'—')+'</a></td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">Randevu</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee">'+(lead.preferred_datetime||'—')+'</td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">Model</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee">'+(MODEL[lead.selected_model]||'—')+'</td></tr>'+
      '</table>'+
      '<div style="margin-top:28px;text-align:center"><a href="'+crmLink+'" style="display:inline-block;background:#C9A96E;color:#181418;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700">CRM\'DE AÇ →</a></div>'+
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

// === KRİTİK BUG FIX: save_lead ===
// Sorun: Ayşe phone/name'i boş ya da geçersiz gönderiyor, server unknown_XXX ile yeni customer yaratıyor
// Çözüm: callId varsa VAPI'den GERÇEK customer.number ve name'i çek, onu kullan
async function handleSaveLead(args,callId){
  const lead_code=genLeadCode();
  let full_name=(args.full_name||'').trim();
  let phoneRaw=args.phone;
  
  // 🔴 YENİ: callId varsa VAPI'den gerçek müşteri bilgisini al
  let vapiCall=null;
  if(callId){
    try{
      vapiCall=await vapi('GET','call/'+callId);
    }catch(e){console.error('VAPI fetch err:',e.message);}
  }
  
  // Phone boş/geçersizse VAPI'den çek
  if(!phoneRaw || phoneRaw.length < 10){
    if(vapiCall?.customer?.number){
      phoneRaw=vapiCall.customer.number;
      console.log('save_lead: phone Ayşe\'den alınamadı, VAPI\'den düzeltildi:',phoneRaw);
    }
  }
  
  // Name boşsa VAPI'den çek
  if(!full_name){
    if(vapiCall?.customer?.name){
      full_name=vapiCall.customer.name;
      console.log('save_lead: name Ayşe\'den alınamadı, VAPI\'den düzeltildi:',full_name);
    }
  }
  
  const phoneDB=normPhoneDB(phoneRaw); // 10 haneli DB format
  const phoneE164=normPhoneE164(phoneRaw); // +90XXXXX format
  
  const MODELS={demo_only:'1 ay demo',demo_plus_investment:'Demo + 3000 USD + %20 bonus',undecided:'Kararsız'};
  const INT={high:'Yüksek',medium:'Orta',low:'Düşük'};
  const CHAN={phone:'Telefon',whatsapp:'WhatsApp',email:'Email'};
  const notesText=['['+lead_code+']','🤖 Ayşe AI araması ('+new Date().toLocaleString('tr-TR')+')','📅 Randevu: '+(args.preferred_datetime||'-'),'🎯 Model: '+(MODELS[args.selected_model]||'-'),'📞 Kanal: '+(CHAN[args.preferred_channel]||'Telefon'),'🔥 İlgi: '+(INT[args.interest_level]||'-'),args.objection?'⚠️ İtiraz: '+args.objection:'',args.notes?'📝 '+args.notes:''].filter(Boolean).join('\n');
  
  let customer_id=null,assignedAgent=null;
  
  // 🔴 YENİ: Phone ile customer bul - DB formatını öncelik olarak dene
  if(phoneDB && phoneDB.length === 10){
    // 1. DB format (10 hane)
    let existing=await sb('GET','customers?phone=eq.'+encodeURIComponent(phoneDB)+'&select=id,notes,assigned_to,full_name').catch(()=>null);
    
    // 2. E164 format (eski kayıtlar)
    if(!Array.isArray(existing)||!existing[0]){
      existing=await sb('GET','customers?phone=eq.'+encodeURIComponent(phoneE164)+'&select=id,notes,assigned_to,full_name').catch(()=>null);
    }
    
    // 3. 90 prefix ile (eski format)
    if(!Array.isArray(existing)||!existing[0]){
      existing=await sb('GET','customers?phone=eq.'+encodeURIComponent('90'+phoneDB)+'&select=id,notes,assigned_to,full_name').catch(()=>null);
    }
    
    if(Array.isArray(existing)&&existing[0]){
      customer_id=existing[0].id;
      // Eğer name yoksa DB'deki orijinal name'i al
      if(!full_name && existing[0].full_name) full_name=existing[0].full_name;
      
      const mergedNotes='['+lead_code+']\n'+notesText+(existing[0].notes?'\n\n--- Önceki ---\n'+existing[0].notes:'');
      if(existing[0].assigned_to){
        const agRow=await sb('GET','users?id=eq.'+existing[0].assigned_to+'&select=id,full_name').catch(()=>null);
        if(Array.isArray(agRow)&&agRow[0])assignedAgent=agRow[0];
      }else assignedAgent=await pickNextAgent();
      
      // EXISTING customer güncellemesi - phone DB format'a da çevir
      const updatePayload={
        notes:mergedNotes,
        status:'hot',
        score:95,
        interest:MODELS[args.selected_model]||args.selected_model,
        assigned_to:assignedAgent?.id||existing[0].assigned_to,
        updated_at:new Date().toISOString()
      };
      // Eğer name alanı boşsa ve şimdi elimizde varsa güncelle
      if(!existing[0].full_name && full_name) updatePayload.full_name=full_name;
      // Phone DB format değilse düzelt
      updatePayload.phone=phoneDB;
      
      await sb('PATCH','customers?id=eq.'+customer_id,updatePayload).catch(()=>{});
      console.log('save_lead: EXISTING customer güncellendi:',customer_id,full_name);
    }
  }
  
  // Eğer halen customer_id yoksa YENİ oluştur - ama sadece phone geçerliyse
  if(!customer_id && phoneDB && phoneDB.length === 10){
    assignedAgent=await pickNextAgent();
    const insPayload={
      full_name:full_name||'İsimsiz Müşteri',
      phone:phoneDB,
      country:'TR',
      status:'hot',
      score:95,
      source:'ayse_ai_call',
      interest:MODELS[args.selected_model]||null,
      notes:notesText,
      assigned_to:assignedAgent?.id||null
    };
    const ins=await sb('POST','customers',insPayload).catch(()=>null);
    if(Array.isArray(ins)&&ins[0])customer_id=ins[0].id;
    console.log('save_lead: YENİ customer oluşturuldu:',customer_id);
  }
  
  // Phone hiç geçerli değilse (son çare), unknown ile kaydet ama uyarı ver
  if(!customer_id){
    console.error('save_lead: KRİTİK - phone geçersiz, unknown customer yaratılıyor');
    assignedAgent=await pickNextAgent();
    const ins=await sb('POST','customers',{
      full_name:full_name||'Ayşe AI Lead (telefon alınamadı)',
      phone:'unknown_'+Date.now(),
      country:'TR',
      status:'hot',
      score:80,
      source:'ayse_ai_call',
      interest:MODELS[args.selected_model]||null,
      notes:'⚠️ TELEFON ALINAMADI\n'+notesText,
      assigned_to:assignedAgent?.id||null
    }).catch(()=>null);
    if(Array.isArray(ins)&&ins[0])customer_id=ins[0].id;
  }
  
  if(callId){
    await sb('POST','calls',{
      vapi_call_id:callId,customer_id,agent_id:assignedAgent?.id||null,
      call_type:'outbound',status:'completed',outcome:'appointment_booked',
      randevu_alindi:true,skor:args.interest_level==='high'?90:args.interest_level==='medium'?60:30,
      ilgi_seviyesi:args.interest_level,itiraz:args.objection||null,
      satis_durumu:'appointment_requested',etiket:lead_code,notes:notesText
    }).catch(()=>{});
  }
  
  const emailData={lead_code,customer_id,full_name,phone:phoneE164||phoneDB,preferred_datetime:args.preferred_datetime,preferred_channel:args.preferred_channel,selected_model:args.selected_model,interest_level:args.interest_level,objection:args.objection,notes:args.notes};
  sendEmail(EXPERT_EMAIL,'🔥 ['+lead_code+'] Yeni sıcak lead: '+(full_name||'İsimsiz'),buildEmailHtml(emailData)).catch(()=>{});
  if(assignedAgent&&STAFF_EMAIL_MAP[assignedAgent.id]){
    sendEmail(STAFF_EMAIL_MAP[assignedAgent.id],'🔥 ['+lead_code+'] Size atandı: '+(full_name||'İsimsiz'),buildEmailHtml(emailData,true)).catch(()=>{});
  }
  wa(ADMIN_WA,'🔥 LEAD '+lead_code+' '+(full_name||'İsimsiz')+' '+(phoneE164||phoneDB)+' '+(MODELS[args.selected_model]||'-')).catch(()=>{});
  
  return lead_code;
}

async function handleRejection(args,callId){
  if(callId){
    await sb('POST','calls',{vapi_call_id:callId,call_type:'outbound',status:'completed',outcome:'rejected',randevu_alindi:false,satis_durumu:'lost',itiraz:args.reason||'unspecified',notes:args.notes||''}).catch(()=>{});
    try{
      const call=await vapi('GET','call/'+callId);
      const phoneRaw=call.customer?.number;
      if(phoneRaw){
        const phoneDB=normPhoneDB(phoneRaw);
        const phoneE164=normPhoneE164(phoneRaw);
        const newStatus=args.reason==='do_not_call'?'blacklist':'ilgilenmedi';
        // Her iki formatta da dene
        await sb('PATCH','customers?phone=eq.'+encodeURIComponent(phoneDB),{status:newStatus,updated_at:new Date().toISOString()}).catch(()=>{});
        await sb('PATCH','customers?phone=eq.'+encodeURIComponent(phoneE164),{status:newStatus,updated_at:new Date().toISOString()}).catch(()=>{});
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
  const phone=normPhoneE164(phone_override||customer?.phone);
  if(!phone||phone.length<10)return {error:'invalid_phone',phone};
  
  const result=await vapi('POST','call',{
    assistantId:ASSISTANT_ID,
    phoneNumberId:PHONE_NUMBER_ID,
    customer:{number:phone,name:customer?.full_name||'Müşteri'}
  });
  
  if(result?.id){
    await sb('POST','calls',{
      vapi_call_id:result.id,customer_id:customer?.id||null,call_type:'outbound',status:'initiated',
      notes:'🤖 Ayşe AI outbound - '+new Date().toLocaleString('tr-TR')
    }).catch(()=>{});
    if(customer?.id){
      await sb('PATCH','customers?id=eq.'+customer.id,{status:'aranıyor',updated_at:new Date().toISOString()}).catch(()=>{});
    }
    return {ok:true,call_id:result.id,phone,customer_name:customer?.full_name};
  }
  return {error:'vapi_failed',detail:result};
}

async function bulkCalls(params){
  const {filter={},limit=10,concurrent=2,delay_ms=3000}=params;
  const actualLimit=Math.min(limit,100);
  
  // FIX: Son 1 saatte aranmamış cold lead'leri bul (client-side filter)
  const hourAgo=new Date(Date.now()-3600000).toISOString();
  const recentCalls=await sb('GET','calls?select=customer_id&created_at=gte.'+hourAgo).catch(()=>[]);
  const recentIds=new Set((Array.isArray(recentCalls)?recentCalls:[]).map(c=>c.customer_id).filter(Boolean));
  
  let query='customers?select=id,full_name,phone,status&limit='+(actualLimit*2); // fazladan çek, filter ile azalt
  if(filter.status)query+='&status=eq.'+encodeURIComponent(filter.status);
  query+='&order=created_at.asc';
  
  const allCustomers=await sb('GET',query);
  if(!Array.isArray(allCustomers)||!allCustomers.length)return {error:'no_customers_found'};
  
  const customers=allCustomers.filter(c=>!recentIds.has(c.id) && c.phone && c.phone.length===10).slice(0,actualLimit);
  
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
    res.end(JSON.stringify({status:'Ayse Server v5.6 - save_lead bug fixed',endpoints:['/save-lead','/log-rejection','/vapi-webhook','/send-whatsapp','/send-email','/make-call','/bulk-call','/call-status/:id','/sync-call','/prices','/get-live-prices'],gmail_configured:!!gmailTransporter,phone_number:'+902128220416',time:new Date().toISOString()}));
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
          res.end(JSON.stringify({results:[{toolCallId:id,result:'Kayıt tamamlandı. Referans kodunuz: '+leadCode}]}));
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
          res.end(JSON.stringify({results:[{toolCallId:id,result:'Red loglandı'}]}));
          return;
        }
        
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
server.listen(PORT,()=>console.log('Ayse Server v5.6 - save_lead bug fixed - port '+PORT+' | Gmail:'+(gmailTransporter?'ON':'OFF')));
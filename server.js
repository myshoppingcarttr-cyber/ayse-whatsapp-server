const http=require('http'),https=require('https');
const VK=process.env.VAPI_KEY||'74b7b21d-f286-4a56-b1ac-2bf37a91d088';
const SB='https://muwynsxukmxjquoqcbac.supabase.co';
const SK=process.env.SB_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3luc3h1a214anF1b3FjYmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjExMzQwMCwiZXhwIjoyMDkxNjg5NDAwfQ.33AsVo1mIeNHznTKnr6IUjVTLP_puNeNFJMS8-GsO30';
const TWILIO_SID=process.env.TWILIO_SID,TWILIO_TOKEN=process.env.TWILIO_TOKEN;
const RESEND_KEY=process.env.RESEND_API_KEY||'';
const EXPERT_EMAIL=process.env.EXPERT_EMAIL||'yigittatarli23@gmail.com';
const FROM_WA='whatsapp:+14155238886',ADMIN_WA='whatsapp:+38267670828';
const CRM_BASE='https://myshoppingcarttr-cyber.github.io/tradebot-crm/?v=71';

function req(opts,body){return new Promise((res,rej)=>{const r=https.request(opts,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}})});r.on('error',rej);if(body)r.write(typeof body==='string'?body:JSON.stringify(body));r.end()});}
function sb(method,path,body){const p=body?JSON.stringify(body):null;return req({hostname:'muwynsxukmxjquoqcbac.supabase.co',path:'/rest/v1/'+path,method,headers:{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':method==='POST'||method==='PATCH'?'return=representation':'return=minimal',...(p?{'Content-Length':Buffer.byteLength(p)}:{})}},p);}
function vapi(method,path,body){const p=body?JSON.stringify(body):null;return req({hostname:'api.vapi.ai',path:'/'+path,method,headers:{'Authorization':'Bearer '+VK,'Content-Type':'application/json',...(p?{'Content-Length':Buffer.byteLength(p)}:{})}},p);}
function wa(to,text){if(!TWILIO_SID)return Promise.resolve();const auth=Buffer.from(TWILIO_SID+':'+TWILIO_TOKEN).toString('base64');const pd='To='+encodeURIComponent(to)+'&From='+encodeURIComponent(FROM_WA)+'&Body='+encodeURIComponent(text);return req({hostname:'api.twilio.com',path:'/2010-04-01/Accounts/'+TWILIO_SID+'/Messages.json',method:'POST',headers:{'Authorization':'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(pd)}},pd);}

function sendEmail(to,subject,html){
  if(!RESEND_KEY){console.log('[Email skipped - no RESEND_KEY]',subject);return Promise.resolve();}
  const body=JSON.stringify({from:'Global Exbina <onboarding@resend.dev>',to,subject,html});
  return req({hostname:'api.resend.com',path:'/emails',method:'POST',headers:{'Authorization':'Bearer '+RESEND_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},body);
}

function genLeadCode(){return 'LEAD-'+Math.floor(1000+Math.random()*9000);}
function normPhone(raw){if(!raw)return'';let p=(''+raw).replace(/[^\d+]/g,'');if(p.startsWith('00'))p='+'+p.slice(2);if(!p.startsWith('+')){if(p.startsWith('44'))p='+'+p;else if(p.startsWith('07'))p='+44'+p.slice(1);else p='+'+p;}return p;}

function buildEmailHtml(lead){
  const MODEL={demo_only:'1 ay ücretsiz demo deneme',demo_plus_investment:'Demo + 3000 USD yatırım + %20 bonus',undecided:'Kararsız (uzman yönlendirecek)'};
  const INT={high:'🟢 YÜKSEK',medium:'🟡 ORTA',low:'🔴 DÜŞÜK'};
  const CHAN={phone:'📞 Telefon',whatsapp:'💬 WhatsApp',email:'📧 Email'};
  const crmLink=CRM_BASE+'&customer='+(lead.customer_id||'');
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f5f0">'+
    '<div style="background:#181418;padding:28px 24px;border-bottom:4px solid #C9A96E">'+
      '<div style="color:#C9A96E;font-size:22px;font-weight:900;letter-spacing:2px">GLOBAL EXBİNA</div>'+
      '<div style="color:#7B6EA8;font-size:11px;letter-spacing:3px;margin-top:6px">SICAK LEAD BİLDİRİMİ</div>'+
    '</div>'+
    '<div style="background:#fff;padding:24px">'+
      '<div style="background:#C9A96E;color:#181418;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:700;font-size:14px;letter-spacing:1px">'+(lead.lead_code||'—')+'</div>'+
      '<h2 style="color:#181418;margin:16px 0 4px;font-size:22px">'+(lead.full_name||'—')+'</h2>'+
      '<div style="color:#888;font-size:13px;margin-bottom:20px">'+(INT[lead.interest_level]||lead.interest_level||'')+' ilgi seviyesi</div>'+
      '<table style="width:100%;border-collapse:collapse;margin:16px 0">'+
        '<tr><td style="padding:10px 0;color:#666;width:150px;border-bottom:1px solid #eee">Telefon</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee"><a href="tel:'+(lead.phone||'')+'" style="color:#C9A96E;text-decoration:none">'+(lead.phone||'—')+'</a></td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">Randevu Zamanı</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee">'+(lead.preferred_datetime||'—')+'</td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">İletişim Kanalı</td><td style="padding:10px 0;color:#181418;border-bottom:1px solid #eee">'+(CHAN[lead.preferred_channel]||'Telefon')+'</td></tr>'+
        '<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee">Tercih Edilen Model</td><td style="padding:10px 0;color:#181418;font-weight:500;border-bottom:1px solid #eee">'+(MODEL[lead.selected_model]||lead.selected_model||'—')+'</td></tr>'+
      '</table>'+
      (lead.objection?'<div style="background:#fff5f5;padding:14px 16px;border-left:4px solid #F46A76;border-radius:4px;margin:16px 0"><div style="color:#F46A76;font-size:11px;letter-spacing:2px;font-weight:600;margin-bottom:6px">MÜŞTERİ İTİRAZI</div><div style="color:#333;font-size:14px">'+lead.objection+'</div></div>':'')+
      (lead.notes?'<div style="background:#faf8f3;padding:14px 16px;border-left:4px solid #C9A96E;border-radius:4px;margin:16px 0"><div style="color:#7B6EA8;font-size:11px;letter-spacing:2px;font-weight:600;margin-bottom:6px">NOTLAR</div><div style="color:#333;font-size:14px;white-space:pre-wrap">'+lead.notes+'</div></div>':'')+
      '<div style="margin-top:28px;text-align:center"><a href="'+crmLink+'" style="display:inline-block;background:#C9A96E;color:#181418;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:1px">CRM\'DE MÜŞTERİYİ AÇ →</a></div>'+
      '<div style="margin-top:20px;padding:12px;background:#f7f5f0;border-radius:6px;text-align:center;font-size:12px;color:#888">Müşteri aradığında referans kodunu isteyebilir: <strong style="color:#181418">'+(lead.lead_code||'—')+'</strong></div>'+
    '</div>'+
    '<div style="padding:16px;text-align:center;color:#888;font-size:11px;background:#f0ede6">Global Exbina · Ayşe AI · Customer ID: '+(lead.customer_id||'—')+'</div>'+
  '</div>';
}

async function handleSaveLead(args,callId){
  const lead_code=genLeadCode();
  const full_name=(args.full_name||'').trim();
  const phone=normPhone(args.phone);
  const MODELS={demo_only:'1 ay demo',demo_plus_investment:'Demo + 3000 USD + %20 bonus',undecided:'Kararsız'};
  const INT={high:'Yüksek',medium:'Orta',low:'Düşük'};
  const CHAN={phone:'Telefon',whatsapp:'WhatsApp',email:'Email'};
  
  // Notes'un İLK satırı LEAD-XXXX kodu (CRM'de kolayca görmek için)
  const notesText=[
    '['+lead_code+']',
    '🤖 Ayşe AI araması ('+new Date().toLocaleString('tr-TR')+')',
    '📅 Randevu: '+(args.preferred_datetime||'-'),
    '🎯 Model: '+(MODELS[args.selected_model]||args.selected_model||'-'),
    '📞 Kanal: '+(CHAN[args.preferred_channel]||'Telefon'),
    '🔥 İlgi: '+(INT[args.interest_level]||'-'),
    args.objection?'⚠️ İtiraz: '+args.objection:'',
    args.notes?'📝 '+args.notes:''
  ].filter(Boolean).join('\n');
  
  let customer_id=null;
  
  // Mevcut customer var mı (phone match)
  if(phone){
    const existing=await sb('GET','customers?phone=eq.'+encodeURIComponent(phone)+'&select=id,notes').catch(()=>null);
    if(Array.isArray(existing)&&existing[0]){
      customer_id=existing[0].id;
      const mergedNotes='['+lead_code+']\n'+notesText+(existing[0].notes?'\n\n--- Önceki ---\n'+existing[0].notes:'');
      await sb('PATCH','customers?id=eq.'+customer_id,{
        notes:mergedNotes,
        status:'hot',
        score:95,
        interest:MODELS[args.selected_model]||args.selected_model,
        updated_at:new Date().toISOString()
      }).catch(e=>console.error('update err',e));
    }
  }
  
  if(!customer_id){
    const newCustomer={
      full_name,
      phone:phone||'unknown_'+Date.now(),
      country:'UK',
      status:'hot',
      score:95,
      source:'ayse_ai_call',
      interest:MODELS[args.selected_model]||args.selected_model||null,
      notes:notesText
    };
    const ins=await sb('POST','customers',newCustomer).catch(e=>{console.error('insert err',e);return null;});
    if(Array.isArray(ins)&&ins[0])customer_id=ins[0].id;
  }
  
  // Call log
  if(callId){
    await sb('POST','calls',{
      vapi_call_id:callId,
      customer_id:customer_id,
      call_type:'outbound',
      status:'completed',
      outcome:'appointment_booked',
      randevu_alindi:true,
      skor:args.interest_level==='high'?90:args.interest_level==='medium'?60:30,
      ilgi_seviyesi:args.interest_level,
      itiraz:args.objection||null,
      satis_durumu:'appointment_requested',
      etiket:lead_code,
      notes:notesText
    }).catch(e=>console.error('call log err',e));
  }
  
  // Email uzmana
  const emailData={
    lead_code,customer_id,full_name,phone,
    preferred_datetime:args.preferred_datetime,
    preferred_channel:args.preferred_channel,
    selected_model:args.selected_model,
    interest_level:args.interest_level,
    objection:args.objection,
    notes:args.notes
  };
  sendEmail(EXPERT_EMAIL,'🔥 ['+lead_code+'] Yeni sıcak lead: '+full_name,buildEmailHtml(emailData)).catch(e=>console.error('email err',e));
  
  // Admin WhatsApp bildirimi
  wa(ADMIN_WA,'🔥 AYŞE SICAK LEAD!\n\n'+lead_code+'\n'+full_name+'\n'+(phone||'-')+'\n\nRandevu: '+(args.preferred_datetime||'-')+'\nModel: '+(MODELS[args.selected_model]||'-')+'\n\nCRM: '+CRM_BASE+'&customer='+(customer_id||'')).catch(()=>{});
  
  return lead_code;
}

async function handleRejection(args,callId){
  if(callId){
    await sb('POST','calls',{
      vapi_call_id:callId,
      call_type:'outbound',
      status:'completed',
      outcome:'rejected',
      randevu_alindi:false,
      satis_durumu:'lost',
      itiraz:args.reason||'unspecified',
      notes:args.notes||''
    }).catch(e=>console.error('rej log err',e));
  }
  return 'logged';
}

async function syncCall(vapiCallId){
  try{
    const call=await vapi('GET','call/'+vapiCallId);
    if(!call||!call.id)return;
    const dur=call.startedAt&&call.endedAt?Math.round((new Date(call.endedAt)-new Date(call.startedAt))/1000):0;
    await sb('PATCH','calls?vapi_call_id=eq.'+vapiCallId,{
      duration_seconds:dur,
      summary:call.analysis?.summary||'',
      transcript:call.transcript||'',
      recording_url:call.recordingUrl||null
    }).catch(()=>{});
  }catch(e){console.error('syncCall error:',e.message);}
}

const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(200);res.end();return;}
  if(req.method==='GET'){res.writeHead(200);res.end(JSON.stringify({status:'Ayse Server v5.1 aktif - customers table',endpoints:['/save-lead','/log-rejection','/vapi-webhook','/send-whatsapp','/twilio-webhook','/sync-call'],expert_email:EXPERT_EMAIL,has_resend:!!RESEND_KEY,time:new Date().toISOString()}));return;}
  if(req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try{
        const data=JSON.parse(body||'{}');
        
        if(req.url==='/save-lead'){
          const tool=data.message?.toolCallList?.[0]||data.message?.functionCall;
          const args=tool?.function?.arguments||tool?.arguments||tool?.parameters||data;
          const id=tool?.id||'x';
          const callId=data.message?.call?.id||data.call?.id;
          const parsedArgs=typeof args==='string'?JSON.parse(args):args;
          const leadCode=await handleSaveLead(parsedArgs,callId);
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:'Kayıt tamamlandı. Müşteriye söyleyeceğiniz referans kodu: '+leadCode}]}));
          return;
        }
        
        if(req.url==='/log-rejection'){
          const tool=data.message?.toolCallList?.[0]||data.message?.functionCall;
          const args=tool?.function?.arguments||tool?.arguments||tool?.parameters||data;
          const id=tool?.id||'x';
          const callId=data.message?.call?.id||data.call?.id;
          const parsedArgs=typeof args==='string'?JSON.parse(args):args;
          await handleRejection(parsedArgs,callId);
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:'Red loglandı'}]}));
          return;
        }
        
        if(req.url==='/vapi-webhook'){
          const type=data.message?.type||data.type;
          const callId=data.message?.call?.id||data.call?.id||data.callId;
          if((type==='end-of-call-report'||type==='call.ended')&&callId){
            syncCall(callId).catch(e=>console.error(e.message));
          }
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        if(req.url==='/sync-call'){
          if(data.vapi_call_id)syncCall(data.vapi_call_id).catch(()=>{});
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        if(req.url==='/send-whatsapp'){
          const tool=data.message?.toolCallList?.[0];
          const args=tool?.function?.arguments||{};
          const phone=(args.customer_phone||'').replace(/[^0-9]/g,'');
          const id=tool?.id||'x';
          const msg='Merhaba! Ben Ayşe, Global Exbina. Demo hesap tamamen ücretsiz. Detay için yanıtlayın.';
          if(phone)wa('whatsapp:+'+phone,msg).catch(()=>{});
          wa(ADMIN_WA,(phone?'Müşteri(+'+phone+'):\n':'')+msg).catch(()=>{});
          res.writeHead(200);res.end(JSON.stringify({results:[{toolCallId:id,result:'Gönderildi'}]}));return;
        }
        
        if(req.url==='/twilio-webhook'){
          const p=new URLSearchParams(body);
          const from=p.get('From')||'';
          const text=(p.get('Body')||'').toLowerCase().trim();
          let reply='Merhaba! Ben Ayşe.\n1-Bot bilgisi\n2-Demo hesap\n3-Randevu';
          if(text.includes('bot')||text==='1')reply='Global Exbina Pro Trading Bot %83 test başarı oranı. Demo ücretsiz!';
          else if(text.includes('demo')||text==='2')reply='Demo ücretsiz! Yanıtlayın, ayarlayalım.';
          else if(text.includes('randevu')||text==='3')reply='Randevu alındı! Saatinizi yazın.';
          wa(from,reply).catch(()=>{});
          wa(ADMIN_WA,'Gelen: '+from+'\n"'+text+'"').catch(()=>{});
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        res.writeHead(200);res.end(JSON.stringify({ok:true}));
      }catch(e){console.error('handler err',e.message);res.writeHead(200);res.end(JSON.stringify({ok:true,err:e.message}));}
    });return;
  }
  res.writeHead(404);res.end('{}');
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Ayse Server v5.1 port '+PORT));
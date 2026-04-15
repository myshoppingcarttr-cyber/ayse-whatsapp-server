const http=require('http'),https=require('https');
const VK=process.env.VAPI_KEY||'74b7b21d-f286-4a56-b1ac-2bf37a91d088';
const SB='https://muwynsxukmxjquoqcbac.supabase.co';
const SK=process.env.SB_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3luc3h1a214anF1b3FjYmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjExMzQwMCwiZXhwIjoyMDkxNjg5NDAwfQ.33AsVo1mIeNHznTKnr6IUjVTLP_puNeNFJMS8-GsO30';
const TWILIO_SID=process.env.TWILIO_SID,TWILIO_TOKEN=process.env.TWILIO_TOKEN;
const FROM_WA='whatsapp:+14155238886',ADMIN_WA='whatsapp:+38267670828';
function req(opts,body){return new Promise((res,rej)=>{const r=https.request(opts,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}})});r.on('error',rej);if(body)r.write(typeof body==='string'?body:JSON.stringify(body));r.end()});}
function sb(method,path,body){const p=body?JSON.stringify(body):null;return req({hostname:'muwynsxukmxjquoqcbac.supabase.co',path:'/rest/v1/'+path,method,headers:{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':method==='POST'?'return=representation':'return=minimal',...(p?{'Content-Length':Buffer.byteLength(p)}:{})}},p);}
function vapi(method,path,body){const p=body?JSON.stringify(body):null;return req({hostname:'api.vapi.ai',path:'/'+path,method,headers:{'Authorization':'Bearer '+VK,'Content-Type':'application/json',...(p?{'Content-Length':Buffer.byteLength(p)}:{})}},p);}
function wa(to,text){if(!TWILIO_SID)return Promise.resolve();const auth=Buffer.from(TWILIO_SID+':'+TWILIO_TOKEN).toString('base64');const pd='To='+encodeURIComponent(to)+'&From='+encodeURIComponent(FROM_WA)+'&Body='+encodeURIComponent(text);return req({hostname:'api.twilio.com',path:'/2010-04-01/Accounts/'+TWILIO_SID+'/Messages.json',method:'POST',headers:{'Authorization':'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(pd)}},pd);}

async function syncCall(vapiCallId){
  try{
    console.log('Sync call:',vapiCallId);
    const call=await vapi('GET','call/'+vapiCallId);
    if(!call||!call.id)return;
    const sd=call.analysis?.structuredData||{};
    const dur=call.startedAt&&call.endedAt?Math.round((new Date(call.endedAt)-new Date(call.startedAt))/1000):0;
    const ilgi=sd.ilgi_seviyesi||(call.endedReason==='no-answer'||call.endedReason==='customer-did-not-answer'?'cevap_vermedi':call.endedReason==='customer-busy'?'mesgul':null);
    let newStatus=null;
    if(sd.demo_kabul||sd.randevu_alindi||sd.ilgi_seviyesi==='yuksek')newStatus='hot';
    else if(sd.ilgi_seviyesi==='orta')newStatus='warm';
    
    // notes kolonuna JSON yaz (migration gerekmez)
    const notesData={
      vapi_call_id:vapiCallId,
      skor:sd.skor||0,
      ilgi_seviyesi:ilgi||'bilinmiyor',
      demo_kabul:sd.demo_kabul||false,
      randevu_alindi:sd.randevu_alindi||false,
      itiraz:sd.itiraz||'',
      takip_notu:sd.takip_notu||'',
      summary:call.analysis?.summary||'',
      success_score:call.analysis?.successEvaluation||null,
      ended_reason:call.endedReason||'ended'
    };
    
    await sb('PATCH','calls?outcome=eq.initiated&notes=like.*'+vapiCallId+'*',{
      outcome:call.endedReason||'ended',
      duration_seconds:dur,
      notes:JSON.stringify(notesData)
    }).catch(()=>{});
    
    // vapi_call_id ile bul (notes JSON içinde)
    const rows=await sb('GET','calls?notes=like.*'+encodeURIComponent(vapiCallId)+'*&select=id,customer_id');
    if(Array.isArray(rows)&&rows[0]){
      const cid=rows[0].customer_id;
      if(cid&&newStatus){
        await sb('PATCH','customers?id=eq.'+cid,{status:newStatus,score:sd.skor||0,notes:'Ayse aradi: '+(sd.takip_notu||new Date().toLocaleString('tr'))});
      }
    }
    
    // Sicak lead bildirimi
    if((sd.skor||0)>=7||sd.demo_kabul||sd.randevu_alindi){
      wa(ADMIN_WA,'SICAK LEAD!\n\nSkor:'+sd.skor+'/10\nDemo:'+(sd.demo_kabul?'EVET':'HAYIR')+'\nRandevu:'+(sd.randevu_alindi?'EVET':'HAYIR')+'\n\n'+(call.analysis?.summary||'').substring(0,200)).catch(()=>{});
    }
  }catch(e){console.error('syncCall error:',e.message);}
}

const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(200);res.end();return;}
  if(req.method==='GET'){res.writeHead(200);res.end(JSON.stringify({status:'Ayse Server v4.0 aktif',time:new Date().toISOString()}));return;}
  if(req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try{
        const data=JSON.parse(body||'{}');
        
        // Vapi webhook
        if(req.url==='/vapi-webhook'){
          const type=data.message?.type||data.type;
          const callId=data.message?.call?.id||data.call?.id||data.callId;
          console.log('Vapi webhook:',type,callId?.substring(0,8));
          if((type==='end-of-call-report'||type==='call.ended')&&callId){
            syncCall(callId).catch(e=>console.error(e.message));
          }
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        // Manuel sync
        if(req.url==='/sync-call'){
          if(data.vapi_call_id)syncCall(data.vapi_call_id).catch(e=>console.error(e.message));
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        // Vapi tool - WA
        if(req.url==='/send-whatsapp'){
          const tool=data.message?.toolCallList?.[0];
          const args=tool?.function?.arguments||{};
          const phone=(args.customer_phone||'').replace(/[^0-9]/g,'');
          const id=tool?.id||'x';
          const msg='Merhaba! Ben Ayse, Global Eksbina finansal danismaniniz.\n\nBugun altin rekor kirdi!\nDemo hesap tamamen ucretsiz.\nDetayli bilgi icin yanitlayin.';
          if(phone)wa('whatsapp:+'+phone,msg).catch(()=>{});
          wa(ADMIN_WA,(phone?'Musteri(+'+phone+'):\n':'')+msg).catch(()=>{});
          res.writeHead(200);res.end(JSON.stringify({results:[{toolCallId:id,result:'Gonderildi.'}]}));return;
        }
        
        // Twilio WA webhook
        if(req.url==='/twilio-webhook'){
          const p=new URLSearchParams(body);
          const from=p.get('From')||'';
          const text=(p.get('Body')||'').toLowerCase().trim();
          let reply='Merhaba! Ben Ayse.\n1-Altin analizi\n2-Demo hesap\n3-Randevu';
          if(text.includes('altin')||text==='1')reply='Bugun altin rekor kirdi! Demo acmak ister misiniz?';
          else if(text.includes('demo')||text==='2')reply='Demo ucretsiz! Ad soyad mail yeterli.';
          else if(text.includes('randevu')||text==='3')reply='Randevu alindi! Saatinizi yazin.';
          wa(from,reply).catch(()=>{});
          wa(ADMIN_WA,'Gelen: '+from+'\n"'+text+'"').catch(()=>{});
          res.writeHead(200);res.end(JSON.stringify({ok:true}));return;
        }
        
        res.writeHead(200);res.end(JSON.stringify({ok:true}));
      }catch(e){res.writeHead(200);res.end(JSON.stringify({ok:true}));}
    });return;
  }
  res.writeHead(404);res.end('{}');
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Ayse Server v4.0 port '+PORT));
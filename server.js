const http = require('http');
const https = require('https');

// Render ENV variables
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const FROM_WA = 'whatsapp:+14155238886';
const ADMIN_WA = 'whatsapp:+38267670828';

const MSGS = {
  genel_bilgi: 'Merhaba! Ben Ayse, Global Eksbina finansal danismaniniz.\n\nBugun altin dort bin sekiz yuz dolar, dort yilin rekoru!\nHurmuz Bogazi gerginligi devam ediyor, analistler bes bin iki yuz dolar hedef veriyor.\n\nDemo hesap tamamen ucretsiz.\n\nDetayli bilgi icin yanitlayin.\n\nGlobal Eksbina - Guvenli Yatirim',
  altin_firsati: 'ALTIN FIRSAT ANALIZI\n\nBugun altin dort bin sekiz yuz dolar.\n\nNEDEN YUKSELIYOR?\n- ABD-Iran gerginligi tirmandi\n- Hurmuz Bogazi riski gundemde\n- Fed faiz belirsizligi\n\nHEDEF: Bes bin iki yuz dolar.\n\nDemo hesap acmak ister misiniz?',
  demo_hesap: 'DEMO HESAP BILGILERI\n\nGlobal Eksbina demo hesap tamamen ucretsiz.\nGercek piyasa verileri, sifir risk.\n\nBaslamak icin ad, soyad ve mail yeterli.\nYanitlayin, hemen baslayalim.',
  randevu: 'Randevu talebiniz alindi!\n\nEn kisa surede danismaniniz ulaşacak.\nTercih ettiginiz saati yazabilirsiniz.\n\nGlobal Eksbina'
};

function sendTwilio(to, body) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_TOKEN).toString('base64');
    const postData = 'To=' + encodeURIComponent(to) + '&From=' + encodeURIComponent(FROM_WA) + '&Body=' + encodeURIComponent(body);
    const opts = {
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Messages.json',
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { console.log('Twilio:', res.statusCode, d.substring(0,80)); resolve({status:res.statusCode}); });
    });
    req.on('error', reject);
    req.write(postData); req.end();
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if (req.method==='OPTIONS'){res.writeHead(200);res.end();return;}
  if (req.method==='GET') { res.writeHead(200); res.end(JSON.stringify({status:'Ayse Twilio Server aktif',time:new Date().toISOString()})); return; }

  if (req.method==='POST') {
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try {
        const data = JSON.parse(body);
        if (req.url==='/send-whatsapp') {
          const tool = data.message?.toolCallList?.[0];
          const args = tool?.function?.arguments||{};
          const type = args.message_type||'genel_bilgi';
          const phone = (args.customer_phone||'').replace(/[^0-9]/g,'');
          const id = tool?.id||'unknown';
          const msg = MSGS[type]||MSGS.genel_bilgi;
          if(phone) { try{ await sendTwilio('whatsapp:+'+phone, msg); }catch(e){ console.error(e.message); } }
          try{ await sendTwilio(ADMIN_WA, (phone?'Musteri(+'+phone+') bilgi talep etti:\n\n':'Bilinmeyen musteri bilgi talep etti:\n\n')+msg); }catch(e){}
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:'WhatsApp mesaji gonderildi.'}]}));
          return;
        }
        if (req.url==='/twilio-webhook') {
          const params = new URLSearchParams(body);
          const from = params.get('From')||'';
          const text = (params.get('Body')||'').toLowerCase();
          let reply = MSGS.genel_bilgi;
          if(text.includes('altin')||text.includes('bilgi')||text==='1') reply=MSGS.altin_firsati;
          else if(text.includes('demo')||text.includes('hesap')||text==='2') reply=MSGS.demo_hesap;
          else if(text.includes('randevu')||text==='3') reply=MSGS.randevu;
          try{ await sendTwilio(from, reply); }catch(e){ console.error(e.message); }
          try{ await sendTwilio(ADMIN_WA, 'Gelen WA: '+from+'\n"'+text+'"'); }catch(e){}
          res.writeHead(200); res.end(JSON.stringify({status:'ok'})); return;
        }
        res.writeHead(200); res.end(JSON.stringify({ok:true}));
      } catch(e) { res.writeHead(200); res.end(JSON.stringify({ok:true})); }
    });
    return;
  }
  res.writeHead(404); res.end('{}');
});

const PORT = process.env.PORT||3000;
server.listen(PORT,()=>console.log('Port '+PORT));
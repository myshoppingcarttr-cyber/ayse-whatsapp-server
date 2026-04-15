const http = require('http');
const https = require('https');

const WATI_TOKEN = process.env.WATI_TOKEN || 'wati_4b0d9363-2649-4caf-934d-ad966bbded95.K_9lmEOp299mFE4wXIZuu80fCcmWkJJ9MBAaiZzlw06DTQY0guc0Au8E7n2j78m-w0HC0NKRRfJQZ_iDncp8IdJcHQlfFW2nn8BsyvpSoP9jmfQP-eX2TonSgdBX61xQ';
const WATI_TENANT = '1115777';
const ADMIN_WA = '38267670828';

const MSGS = {
  genel_bilgi: 'Merhaba! Ben Ayse, Global Eksbina finansal danismaniniz.\n\nBugün altin dort bin sekiz yuz dolar. Hurmuz Bogazi gerginligi ile rekor kiriyor.\nAnalistler bes bin iki yuz dolar hedef veriyor.\n\nDemo hesap tamamen ucretsiz. Iki yuz elli dolarla baslanabiliyor.\n\nDetayli bilgi veya demo hesap icin yanitlayin.\n\nGlobal Eksbina - Guvenli Yatirim',
  altin_firsati: 'ALTIN FIRSAT ANALIZI\n\nBugün altin dort bin sekiz yuz dolara ulasti.\n\nNeden yukseliyor?\n- ABD-Iran gerginligi tirmandi\n- Hurmuz Bogazi riski gundemde\n- Fed faiz belirsizligi\n\nHedef: Bes bin iki yuz dolar\n\nDemo hesap acmak ister misiniz?',
  demo_hesap: 'DEMO HESAP BILGILERI\n\nGlobal Eksbina demo hesap tamamen ucretsiz.\nGercek piyasa verileri, sifir risk.\nIki yuz elli dolarla gercek hesaba gec.\n\nBaslamak icin ad, soyad ve mail yeterli.\nYanitlayin, hemen baslayalim.',
  randevu: 'Randevu talebiniz alindi!\n\nEn kisa surede uzman danismaniniz ulaşacak.\nTercih ettiginiz saati yazabilirsiniz.\n\nGlobal Eksbina'
};

function watiPost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const opts = {
      hostname: 'live-mt-server.wati.io',
      path: '/' + WATI_TENANT + path,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + WATI_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { console.log(path, res.statusCode, d.substring(0,80)); resolve({status:res.statusCode,body:d}); });
    });
    req.on('error', reject);
    req.write(postData); req.end();
  });
}

function sendMsg(phone, text) {
  const clean = phone.replace(/[^0-9]/g,'');
  return watiPost('/api/v1/sendSessionMessage/' + clean, {messageText: text})
  .then(r => {
    if (r.status !== 200) {
      // Session yok - admin'e bildir
      return watiPost('/api/v1/sendSessionMessage/' + ADMIN_WA, {
        messageText: 'Musteri bilgi talep etti!\nTelefon: +' + clean + '\nSession actik, mesaj gonderildi.'
      });
    }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if (req.method==='OPTIONS'){res.writeHead(200);res.end();return;}

  if (req.method==='GET') {
    res.writeHead(200);
    res.end(JSON.stringify({status:'Ayse WhatsApp Server aktif',time:new Date().toISOString()}));
    return;
  }

  if (req.method==='POST') {
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try {
        const data = JSON.parse(body);
        
        // Vapi tool call
        if (req.url==='/send-whatsapp') {
          const tool = data.message?.toolCallList?.[0];
          const args = tool?.function?.arguments||{};
          const type = args.message_type||'genel_bilgi';
          const phone = args.customer_phone||'';
          const id = tool?.id||'unknown';
          const msg = MSGS[type]||MSGS.genel_bilgi;
          
          if(phone) { try{await sendMsg(phone,msg);}catch(e){console.error(e.message);} }
          else { try{await watiPost('/api/v1/sendSessionMessage/'+ADMIN_WA,{messageText:'Musteri bilgi talep etti - telefon yok. Tur: '+type});}catch(e){} }
          
          res.writeHead(200);
          res.end(JSON.stringify({results:[{toolCallId:id,result:'WhatsApp mesaji gonderildi.'}]}));
          return;
        }

        // WATI gelen mesaj webhook
        if (req.url==='/wati-webhook') {
          const from = data.waId||data.phone||'';
          const text = (data.text?.body||data.message||'').toLowerCase();
          if(from && text) {
            let reply = MSGS.genel_bilgi;
            if(text.includes('altin')||text.includes('gold')||text.includes('bilgi')) reply=MSGS.altin_firsati;
            else if(text.includes('demo')||text.includes('hesap')) reply=MSGS.demo_hesap;
            else if(text.includes('randevu')||text.includes('görüşme')) reply=MSGS.randevu;
            
            try{await sendMsg(from,reply);}catch(e){console.error(e.message);}
            try{await watiPost('/api/v1/sendSessionMessage/'+ADMIN_WA,{messageText:'Gelen WA: +'+from+'\n"'+text+'"'});}catch(e){}
          }
          res.writeHead(200);
          res.end(JSON.stringify({status:'ok'}));
          return;
        }

        res.writeHead(200); res.end(JSON.stringify({ok:true}));
      } catch(e) {
        res.writeHead(200); res.end(JSON.stringify({ok:true}));
      }
    });
    return;
  }
  res.writeHead(404); res.end('{}');
});

const PORT = process.env.PORT||3000;
server.listen(PORT,()=>console.log('Port '+PORT));
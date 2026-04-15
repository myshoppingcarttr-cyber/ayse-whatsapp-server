const http = require('http');
const https = require('https');
const dgram = require('dgram');

// ENV
const SIP_SERVER   = process.env.SIP_SERVER   || '185.169.64.170';
const SIP_USER     = process.env.SIP_USERNAME  || '902128220416';
const SIP_PASS     = process.env.SIP_PASSWORD  || 'hlmig5n';
const SIP_PORT     = 5060;
const VAPI_KEY     = process.env.VAPI_KEY      || '74b7b21d-f286-4a56-b1ac-2bf37a91d088';
const VAPI_ASST    = process.env.VAPI_ASST     || '133aa70c-db4b-4155-be6b-220450c0b21a';
const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const FROM_WA      = 'whatsapp:+14155238886';
const ADMIN_WA     = 'whatsapp:+38267670828';

// ── SIP YARDIMCI FONKSİYONLARI ──────────────────────────────────────────
let cseq = 1;
function md5(s) {
  // Node built-in crypto
  return require('crypto').createHash('md5').update(s).digest('hex');
}

function buildSipCall(toNumber, callId, tag, branch, nonce, realm) {
  // E.164 format
  const to = toNumber.replace(/[^0-9+]/g,'');
  const toUri = 'sip:' + to.replace('+','') + '@' + SIP_SERVER;
  const fromUri = 'sip:' + SIP_USER + '@' + SIP_SERVER;

  // Digest auth hesapla
  const ha1 = md5(SIP_USER + ':' + realm + ':' + SIP_PASS);
  const ha2 = md5('INVITE:' + toUri);
  const response = md5(ha1 + ':' + nonce + ':' + md5(ha2));

  return [
    'INVITE ' + toUri + ' SIP/2.0',
    'Via: SIP/2.0/UDP 0.0.0.0:5060;branch=' + branch,
    'From: <' + fromUri + '>;tag=' + tag,
    'To: <' + toUri + '>',
    'Call-ID: ' + callId,
    'CSeq: ' + (cseq++) + ' INVITE',
    'Contact: <' + fromUri + '>',
    'Content-Type: application/sdp',
    'Max-Forwards: 70',
    'Authorization: Digest username="' + SIP_USER + '",realm="' + realm + '",nonce="' + nonce + '",uri="' + toUri + '",response="' + response + '",algorithm=MD5',
    'Content-Length: 0',
    '',
    ''
  ].join('\r\n');
}

// SIP ile telefon ara
function sipCall(toNumber) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const callId = Math.random().toString(36).substring(2) + '@ayse';
    const tag    = Math.random().toString(36).substring(2);
    const branch = 'z9hG4bK' + Math.random().toString(36).substring(2);
    let   step   = 'register';
    let   timer;

    socket.on('message', (msg) => {
      const text = msg.toString();
      console.log('SIP <-- ' + text.substring(0,120));
      clearTimeout(timer);

      if (text.includes('401') || text.includes('407')) {
        // Auth challenge
        const nonceM = text.match(/nonce="([^"]+)"/);
        const realmM = text.match(/realm="([^"]+)"/);
        if (!nonceM || !realmM) { reject(new Error('Auth parse failed')); socket.close(); return; }
        const invite = buildSipCall(toNumber, callId, tag, branch, nonceM[1], realmM[1]);
        console.log('SIP --> INVITE (auth)');
        const buf = Buffer.from(invite);
        socket.send(buf, SIP_PORT, SIP_SERVER);
        step = 'invite_sent';
      } else if (text.includes('SIP/2.0 100') || text.includes('SIP/2.0 180')) {
        console.log('SIP: Çalıyor...');
      } else if (text.includes('SIP/2.0 200')) {
        console.log('SIP: Cevaplandı!');
        // ACK gönder
        const ack = ['ACK sip:' + toNumber.replace('+','') + '@' + SIP_SERVER + ' SIP/2.0',
          'Via: SIP/2.0/UDP 0.0.0.0:5060;branch=' + branch,
          'From: <sip:' + SIP_USER + '@' + SIP_SERVER + '>;tag=' + tag,
          'To: <sip:' + toNumber.replace('+','') + '@' + SIP_SERVER + '>',
          'Call-ID: ' + callId, 'CSeq: ' + cseq + ' ACK',
          'Content-Length: 0', '', ''].join('\r\n');
        socket.send(Buffer.from(ack), SIP_PORT, SIP_SERVER);
        resolve({ callId, status: 'answered' });
        setTimeout(() => socket.close(), 3000);
      } else if (text.includes('SIP/2.0 4') || text.includes('SIP/2.0 5') || text.includes('SIP/2.0 6')) {
        reject(new Error('SIP Error: ' + text.substring(8,15)));
        socket.close();
      }
    });

    socket.on('error', (e) => { reject(e); try{socket.close();}catch(x){} });

    // İlk INVITE (auth olmadan) gönder
    const firstInvite = [
      'INVITE sip:' + toNumber.replace('+','').replace(/[^0-9]/g,'') + '@' + SIP_SERVER + ' SIP/2.0',
      'Via: SIP/2.0/UDP 0.0.0.0:5060;branch=' + branch,
      'From: <sip:' + SIP_USER + '@' + SIP_SERVER + '>;tag=' + tag,
      'To: <sip:' + toNumber.replace('+','').replace(/[^0-9]/g,'') + '@' + SIP_SERVER + '>',
      'Call-ID: ' + callId, 'CSeq: ' + (cseq++) + ' INVITE',
      'Contact: <sip:' + SIP_USER + '@0.0.0.0>',
      'Max-Forwards: 70', 'Content-Length: 0', '', ''
    ].join('\r\n');

    console.log('SIP --> INVITE ' + toNumber);
    const buf = Buffer.from(firstInvite);
    socket.send(buf, SIP_PORT, SIP_SERVER, (err) => {
      if (err) { reject(err); socket.close(); }
    });

    timer = setTimeout(() => { reject(new Error('SIP timeout')); try{socket.close();}catch(x){} }, 30000);
  });
}

// Vapi outbound call
function vapiCall(toNumber, leadName) {
  return new Promise((resolve, reject) => {
    const firstName = (leadName||'').split(' ')[0] || 'Sayın';
    const body = JSON.stringify({
      assistantId: VAPI_ASST,
      customer: { number: toNumber, name: leadName || '' },
      assistantOverrides: {
        firstMessage: 'Merhaba ' + firstName + ', ben Ayse, Global Eksbina finansal danismaniniz. Bugun altin rekor kirdi, altmis saniyeniz var mi?'
      }
    });
    const opts = {
      hostname: 'api.vapi.ai',
      path: '/call/phone',
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + VAPI_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try{ resolve(JSON.parse(d)); }catch(e){ reject(e); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// WhatsApp gönder (Twilio)
function sendWA(to, text) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return Promise.resolve();
  return new Promise((resolve) => {
    const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_TOKEN).toString('base64');
    const pd = 'To=' + encodeURIComponent(to) + '&From=' + encodeURIComponent(FROM_WA) + '&Body=' + encodeURIComponent(text);
    const opts = {
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Messages.json',
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(pd) }
    };
    const req = https.request(opts, res => { res.on('data', ()=>{}); res.on('end', resolve); });
    req.on('error', resolve);
    req.write(pd); req.end();
  });
}

// ── HTTP SERVER ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'Ayse SIP+WA Server aktif', sip: SIP_SERVER, time: new Date().toISOString() }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        // Outbound SIP arama endpoint
        if (req.url === '/sip-call') {
          const { phone, name, lead_id } = data;
          if (!phone) { res.writeHead(400); res.end(JSON.stringify({ error: 'phone gerekli' })); return; }
          console.log('Outbound SIP arama:', phone, name);
          try {
            const result = await sipCall(phone);
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, callId: result.callId, status: result.status }));
          } catch(e) {
            console.error('SIP hata:', e.message);
            // SIP başarısız olursa Vapi ile dene
            try {
              const vr = await vapiCall(phone, name);
              res.writeHead(200);
              res.end(JSON.stringify({ ok: true, callId: vr.id, via: 'vapi_fallback' }));
            } catch(e2) {
              res.writeHead(200);
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          }
          return;
        }

        // Vapi tool - WhatsApp gönder
        if (req.url === '/send-whatsapp') {
          const tool = data.message?.toolCallList?.[0];
          const args = tool?.function?.arguments || {};
          const type = args.message_type || 'genel_bilgi';
          const phone = (args.customer_phone || '').replace(/[^0-9]/g,'');
          const id = tool?.id || 'unknown';
          const msgs = {
            genel_bilgi: 'Merhaba! Ben Ayse, Global Eksbina finansal danismaniniz.\n\nBugun altin dort bin sekiz yuz dolar, dort yilin rekoru!\n\nDemo hesap tamamen ucretsiz.\nDetayli bilgi icin yanitlayin.',
            altin_firsati: 'ALTIN FIRSAT\n\nBugun altin dort bin sekiz yuz dolar.\nHedef bes bin iki yuz dolar.\n\nDemo hesap acmak ister misiniz?',
            demo_hesap: 'DEMO HESAP\n\nUcretsiz. Gercek piyasa. Sifir risk.\nBaslamak icin yanitlayin.',
            randevu: 'Randevu talebiniz alindi! Tercih ettiginiz saati yazin.'
          };
          const msg = msgs[type] || msgs.genel_bilgi;
          if(phone) try{ await sendWA('whatsapp:+'+phone, msg); }catch(e){}
          try{ await sendWA(ADMIN_WA, (phone?'Musteri(+'+phone+'):':'')+msg); }catch(e){}
          res.writeHead(200);
          res.end(JSON.stringify({ results:[{ toolCallId:id, result:'WhatsApp gonderildi.' }] }));
          return;
        }

        // Twilio webhook - gelen WA mesajları
        if (req.url === '/twilio-webhook') {
          const params = new URLSearchParams(body);
          const from = params.get('From') || '';
          const text = (params.get('Body') || '').toLowerCase();
          let reply = 'Merhaba! Ben Ayse, Global Eksbina. Size nasil yardimci olabilirim?\n1- Altin analizi\n2- Demo hesap\n3- Randevu';
          if(text.includes('altin')||text==='1') reply = 'Bugun altin dort bin sekiz yuz dolar! Hedef bes bin iki yuz. Demo hesap acmak ister misiniz?';
          else if(text.includes('demo')||text==='2') reply = 'Demo hesap ucretsiz! Ad, soyad ve mail yeterli. Simdi acalim mi?';
          else if(text.includes('randevu')||text==='3') reply = 'Randevu talebiniz alindi. Tercih ettiginiz saati yazin.';
          try{ await sendWA(from, reply); }catch(e){}
          try{ await sendWA(ADMIN_WA, 'Gelen: '+from+'\n"'+text+'"'); }catch(e){}
          res.writeHead(200); res.end(JSON.stringify({ status:'ok' })); return;
        }

        res.writeHead(200); res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        console.error(e.message);
        res.writeHead(200); res.end(JSON.stringify({ ok: true }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('{}');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Ayse SIP+WA Server port ' + PORT));
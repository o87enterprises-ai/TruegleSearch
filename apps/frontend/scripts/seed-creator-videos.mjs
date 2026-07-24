// Seed src/content/creatorVideosFallback.js with a snapshot of each creator's
// latest uploads (fallback for when YouTube throttles the live RSS proxy).
// Writes after every channel so partial runs still persist. Re-run any time.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../src/content/creatorVideosFallback.js');

const creators = [
  ['UCZw8SuiTYSvPKmnMe8LDtpA','dark-waters-9'],['UCQT9VG5hpLKp8of41fvDdtw','true-story'],
  ['UCdcfgAjgP1OvNIFTWkbPV8Q','bass-forge'],['UC-ocTFTWBWI0b-wjYoCKuPg','wright-7x'],
  ['UCmxXPdAg3iQaepCBO2JHjVA','bryce-is-right'],['UCCVP1ck3ucAgLJFJNlPWamw','jon-levi'],
  ['UCQVBGSq7vdLanRbowiu163w','mind-unveiled'],['UC0UpxtDnri_fa5fB_PoAYhw','xevi'],
  ['UCB9LqQNtyPPdW1prv0h8_5Q','stolen-timelines'],['UC8DA4o0SyaGfyVaBLbF5EXg','adam-mockler'],
];
const dec=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const parse=xml=>xml.split('<entry>').slice(1).map(e=>{const id=(e.match(/<yt:videoId>([^<]+)</)||[])[1];if(!id)return null;
  return {videoId:id,title:dec((e.match(/<title>([^<]*)</)||[])[1]||''),published:(e.match(/<published>([^<]+)</)||[])[1]||null,
    thumbnail:(e.match(/<media:thumbnail\s+url="([^"]+)"/)||[])[1]||`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,url:`https://www.youtube.com/watch?v=${id}`};}).filter(Boolean);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out={}; for(const [cid] of creators) out[cid]=[];
function write(){const banner=`// Build-time snapshot of each creator's latest uploads, keyed by channelId.\n// Fallback for when the live API returns no videos (YouTube throttles RSS from\n// datacenter IPs). Refresh: node scripts/seed-creator-videos.mjs. Last: ${new Date().toISOString().slice(0,10)}.\n`;
  writeFileSync(OUT, banner+'export const CREATOR_VIDEOS_FALLBACK = '+JSON.stringify(out,null,2)+';\n\nexport const fallbackVideos = (channelId) => CREATOR_VIDEOS_FALLBACK[channelId] || [];\n');}
for(const [cid,slug] of creators){
  for(let a=1;a<=4 && out[cid].length===0;a++){
    try{const r=await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0','Accept-Language':'en-US,en;q=0.9'}});
      if(r.status===200) out[cid]=parse(await r.text()).slice(0,6);}catch{}
    if(out[cid].length===0) await sleep(5000);
  }
  console.error(`${slug}: ${out[cid].length}`); write(); await sleep(2000);
}

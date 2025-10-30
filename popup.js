async function loadState(){
  return new Promise((resolve)=>{
    chrome.storage.local.get(['scanCount','isPremium','cvText','lastReset'], (data)=> resolve(data||{}));
  });
}
function setText(id, txt){ document.getElementById(id).textContent = txt; }
async function init(){
  const st = await loadState();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if(!st.lastReset || new Date(st.lastReset) < monthStart){
    chrome.storage.local.set({ scanCount: 0, lastReset: now.toISOString() });
    st.scanCount = 0;
  }
  const isPremium = !!st.isPremium;
  setText('status-pill', `Status: ${isPremium ? 'Premium ✓' : 'Free'}`);
  setText('scan-pill', `Scans: ${isPremium ? '∞' : `${st.scanCount||0}/10`}`);
  document.getElementById('cv-text').value = st.cvText || '';
}
async function saveCV(text){
  const cleaned = String(text||'').replace(/<[^>]*>/g,'').slice(0, 50000);
  await chrome.storage.local.set({ cvText: cleaned });
}
document.getElementById('save').onclick = async () => {
  const txt = document.getElementById('cv-text').value;
  if(!txt || txt.trim().length < 50){ alert('Please paste at least 50 characters of CV text.'); return; }
  await saveCV(txt);
  alert('CV saved. Now open a LinkedIn job to see the overlay.');
};
document.getElementById('clear').onclick = async () => {
  await chrome.storage.local.remove(['cvText']);
  document.getElementById('cv-text').value='';
};
document.getElementById('cv-file').addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const t = await f.text();
  document.getElementById('cv-text').value = t;
});
init();

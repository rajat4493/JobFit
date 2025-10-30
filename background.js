chrome.runtime.onInstalled.addListener(()=>console.log('CVSync draft installed'));
chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
  if(request.action === 'matchJob'){
    // Local heuristic draft (no server yet): score by keyword overlap
    try{
      const { cvText, job } = request.data || {};
      if(!cvText || !job || !job.description){ return sendResponse({success:false}); }
      const cv = cvText.toLowerCase();
      const text = (job.title + ' ' + job.description).toLowerCase();
      const keywords = Array.from(new Set(text.match(/[a-zA-Z][a-zA-Z0-9+#.-]{2,}/g)||[])).slice(0,200);
      let hits = 0; const reasons = [];
      const strong = [];
      keywords.forEach(k=>{ if(cv.includes(k)) strong.push(k); });
      hits = strong.length;
      const score = Math.min(100, Math.round((hits / Math.max(20, keywords.length)) * 100));
      const topWords = keywords.slice(0,40);
      const missing = topWords.filter(k=>!cv.includes(k)).slice(0,5);
      missing.forEach(m=> reasons.push(`Consider adding: ${m}`));
      if(strong.slice(0,3).length) reasons.unshift(`Matches found: ${strong.slice(0,3).join(', ')}`);
      return sendResponse({success:true, data:{ matchScore: score, reasons }});
    }catch(e){
      console.warn('Draft matcher failed', e);
      return sendResponse({success:false});
    }
  }
});

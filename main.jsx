import { useState, useEffect, useRef } from "react";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://fktltadtquxrtnunnojd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdGx0YWR0cXV4cnRudW5ub2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTI4OTMsImV4cCI6MjA5NjY4ODg5M30.1ppxNnLeAGoTV1SVv4Ex9fYILoRDLeGCtp2HmLLwIsI";

const sb = {
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Prefer": "return=representation",
  },
  async getLeads() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*,lead_timeline(*)&order=created_at.desc`, { headers: this.headers });
    const data = await r.json();
    return data.map(l => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      address: l.address||"",
      rooms: l.rooms,
      price: l.price||"",
      source: l.source||"ישיר",
      status: l.status||"new",
      notes: l.notes||"",
      reminder: l.reminder||"",
      followUpDate: l.follow_up_date||"",
      followUpNote: l.follow_up_note||"",
      meetingDate: l.meeting_date||"",
      meetingTime: l.meeting_time||"",
      exclusiveStart: l.exclusive_start||"",
      exclusiveEnd: l.exclusive_end||"",
      soldDate: l.sold_date||"",
      meetingSummary: l.meeting_summary||null,
      timeline: (l.lead_timeline||[]).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(t=>({
        date: t.created_at.slice(0,10),
        type: t.type,
        text: t.text,
      })),
    }));
  },
  async addLead(lead) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        name: lead.name, phone: lead.phone, address: lead.address||"",
        rooms: lead.rooms ? (parseFloat(lead.rooms) || null) : null,
        price: lead.price||"", source: lead.source||"ישיר",
        status: lead.status||"new", notes: lead.notes||"", reminder: lead.reminder||"",
        follow_up_date: lead.followUpDate||null, follow_up_note: lead.followUpNote||"",
        meeting_date: lead.meetingDate||null, meeting_time: lead.meetingTime||null,
        exclusive_start: lead.exclusiveStart||null, exclusive_end: lead.exclusiveEnd||null,
        sold_date: lead.soldDate||null, meeting_summary: lead.meetingSummary||null,
      }),
    });
    if(!r.ok) {
      const errText = await r.text();
      throw new Error(`Supabase error ${r.status}: ${errText}`);
    }
    const data = await r.json();
    const saved = Array.isArray(data) ? data[0] : data;
    // Add initial timeline entry
    if(saved?.id && lead.timeline?.length) {
      await this.addTimelineEntry(saved.id, lead.timeline[0].type, lead.timeline[0].text);
    }
    return saved;
  },
  async updateLead(lead) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify({
        name: lead.name, phone: lead.phone, address: lead.address||"",
        rooms: lead.rooms ? (parseFloat(lead.rooms) || null) : null,
        price: lead.price||"", source: lead.source||"ישיר",
        status: lead.status, notes: lead.notes||"", reminder: lead.reminder||"",
        follow_up_date: lead.followUpDate||null, follow_up_note: lead.followUpNote||"",
        meeting_date: lead.meetingDate||null, meeting_time: lead.meetingTime||null,
        exclusive_start: lead.exclusiveStart||null, exclusive_end: lead.exclusiveEnd||null,
        sold_date: lead.soldDate||null, meeting_summary: lead.meetingSummary||null,
      }),
    });
    if(!r.ok) {
      const errText = await r.text();
      console.error(`Supabase update error ${r.status}: ${errText}`);
    }
  },
  async deleteLead(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "DELETE", headers: this.headers,
    });
  },
  async addTimelineEntry(leadId, type, text) {
    await fetch(`${SUPABASE_URL}/rest/v1/lead_timeline`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ lead_id: leadId, type, text }),
    });
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:        { label: "ליד חדש",        color: "#888780", bg: "#F1EFE8" },
  contact:    { label: "נוצר קשר",       color: "#185FA5", bg: "#E6F1FB" },
  meeting:    { label: "פגישה נקבעה",    color: "#854F0B", bg: "#FAEEDA" },
  after_meet: { label: "לאחר פגישה",     color: "#72243E", bg: "#FBEAF0" },
  followup:   { label: "פולואפ",         color: "#534AB7", bg: "#EEEDFE" },
  signing:    { label: "בגיוס חוזה",     color: "#3B6D11", bg: "#EAF3DE" },
  signed:     { label: "גויס לבלעדיות", color: "#0F6E56", bg: "#E1F5EE" },
  lost:       { label: "לא רלוונטי",     color: "#993C1D", bg: "#FAECE7" },
  excl_other: { label: "בלעדיות אצל אחר", color: "#5F5E5A", bg: "#F1EFE8" },
};

const URGENCY = {
  fire: { border:"#D85A30", labelBg:"#FCEBEB", labelColor:"#A32D2D", dot:"#D85A30" },
  warm: { border:"#EF9F27", labelBg:"#FAEEDA", labelColor:"#854F0B", dot:"#EF9F27" },
  cool: { border:"#85B7EB", labelBg:"#E6F1FB", labelColor:"#185FA5", dot:"#85B7EB" },
  cold: { border:"var(--color-border-tertiary)", labelBg:"#F1EFE8", labelColor:"#5F5E5A", dot:"#B4B2A9" },
};

const SAMPLE_LEADS = [
  { id:1, name:"דוד כהן", phone:"050-1234567", address:"רח' הרצל 12, תל אביב", rooms:4, price:"3,200,000", status:"after_meet", source:"המלצה", meetingDate:"2025-06-09", meetingTime:"10:00", followUpDate:"2025-06-10", followUpNote:"אמר שיש מתווך נוסף — לפעול מהר", reminder:"לחזור אחרי הפגישה", notes:"נכס בבעלות מלאה, מחיר גמיש", timeline:[{date:"2025-06-09",type:"meeting",text:"פגישה ראשונה התקיימה"},{date:"2025-06-05",type:"call",text:"שיחה ראשונה"},{date:"2025-06-05",type:"new",text:"נוסף"}] },
  { id:2, name:"מיכל לוי", phone:"052-9876543", address:"רח' ביאליק 5, רמת גן", rooms:5, price:"4,800,000", status:"contact", source:"פייסבוק", meetingDate:"", meetingTime:"", followUpDate:"2025-06-15", followUpNote:"חוזרת מתאילנד ב-15.6", reminder:"ליצור קשר לאחר חזרה", notes:"ממתינה להצעת שיווק", timeline:[{date:"2025-06-06",type:"call",text:"שיחה שנייה"},{date:"2025-06-04",type:"new",text:"נוסף"}] },
  { id:3, name:"אבי בן דוד", phone:"054-5551234", address:"שד' ירושלים 88, תל אביב", rooms:3, price:"2,600,000", status:"signed", source:"שילוט", meetingDate:"2025-06-02", meetingTime:"14:00", followUpDate:"", followUpNote:"", reminder:"", notes:"חוזה בלעדיות עד 2.9", exclusiveStart:"2025-06-02", exclusiveEnd:"2025-09-02", soldDate:"", timeline:[{date:"2025-06-02",type:"signed",text:"חתם על בלעדיות"},{date:"2025-05-27",type:"meeting",text:"פגישה ראשונה"},{date:"2025-05-25",type:"new",text:"נוסף"}] },
  { id:4, name:"רחל גולן", phone:"053-7778899", address:"רח' סוקולוב 3, הרצליה", rooms:4, price:"", status:"new", source:"ישיר", meetingDate:"", meetingTime:"", followUpDate:"2025-06-10", followUpNote:"ליד חדש", reminder:"פנייה ראשונה", notes:"", timeline:[{date:"2025-06-09",type:"new",text:"נוסף"}] },
  { id:5, name:"שמואל ברק", phone:"050-1112222", address:"בן יהודה 55, תל אביב", rooms:3, price:"2,100,000", status:"meeting", source:"המלצה", meetingDate:"2025-06-11", meetingTime:"17:00", followUpDate:"2025-06-11", followUpNote:"פגישה שנייה מחר", reminder:"", notes:"מעוניין אך לא בטוח במחיר", timeline:[{date:"2025-06-08",type:"meeting",text:"פגישה ראשונה"},{date:"2025-06-06",type:"new",text:"נוסף"}] },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function formatDate(d) { if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}/${m}`; }
function normalizePhone(phone) { return (phone||"").replace(/\D/g,"").replace(/^972/,"0"); }
function initials(n) { return n.split(" ").map(w=>w[0]).join("").slice(0,2); }
function avatarBg(n) {
  const c=[{bg:"#EEEDFE",c:"#534AB7"},{bg:"#E1F5EE",c:"#0F6E56"},{bg:"#FAEEDA",c:"#854F0B"},{bg:"#E6F1FB",c:"#185FA5"},{bg:"#FBEAF0",c:"#72243E"}];
  return c[n.charCodeAt(0)%c.length];
}
function calcUrgency(lead) {
  const today = new Date(); today.setHours(0,0,0,0);
  if(["signed","lost","excl_other"].includes(lead.status)) return {level:"cold",score:0,label:""};
  if(lead.status==="new") return {level:"fire",score:100,label:"ליד חדש — פנה עכשיו"};
  if(lead.followUpDate) {
    const d=new Date(lead.followUpDate); d.setHours(0,0,0,0);
    const diff=Math.floor((d-today)/86400000);
    if(diff<0)  return {level:"fire",score:95,label:`עבר ${Math.abs(diff)} ימים מהיעד`};
    if(diff===0) return {level:"fire",score:90,label:"פולואפ היום"};
    if(diff<=2)  return {level:"warm",score:70,label:`פולואפ בעוד ${diff} ימים`};
    if(diff<=7)  return {level:"warm",score:50,label:`פולואפ ב-${formatDate(lead.followUpDate)}`};
    return {level:"cool",score:20,label:`עתידי — ${formatDate(lead.followUpDate)}`};
  }
  if(lead.status==="after_meet") {
    const days=lead.timeline.length>0?Math.floor((today-new Date(lead.timeline[0].date))/86400000):0;
    if(days>=5) return {level:"fire",score:90,label:`${days} ימים בלי קשר`};
    return {level:"warm",score:60,label:"אחרי פגישה — בטיפול"};
  }
  if(lead.status==="contact") return {level:"warm",score:55,label:"לתאם פגישה"};
  if(lead.status==="meeting") return {level:"warm",score:50,label:"פגישה קבועה"};
  return {level:"cool",score:25,label:"בטיפול"};
}
function addMonths(dateStr, months) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0,10);
}

function openWA(phone,msg) {
  const n=phone.replace(/\D/g,"").replace(/^0/,"");
  window.open(`https://wa.me/972${n}?text=${encodeURIComponent(msg)}`,"_blank");
}
function openCall(phone) { window.open(`tel:${phone}`); }

// ─── Styles ───────────────────────────────────────────────────────────────────
const g = {
  screen:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:80},
  topbar:{background:"var(--color-background-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},
  card:{background:"var(--color-background-primary)",borderRadius:16,padding:"14px 14px 10px",marginBottom:10,border:"0.5px solid var(--color-border-tertiary)"},
  bigBtn:{flex:1,padding:"11px 6px",borderRadius:12,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:5},
  iconBtn:{padding:"11px 12px",borderRadius:12,border:"none",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"},
  inp:{width:"100%",padding:"12px 14px",borderRadius:12,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:15,outline:"none"},
  lbl:{fontSize:12,color:"var(--color-text-secondary)",marginBottom:5,display:"block"},
  section:{fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",margin:"14px 0 6px",letterSpacing:0.4},
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({msg}) {
  return msg ? (
    <div style={{position:"fixed",bottom:90,right:"50%",transform:"translateX(50%)",background:"#2C2C2A",color:"white",borderRadius:10,padding:"10px 18px",fontSize:13,zIndex:999,whiteSpace:"nowrap",pointerEvents:"none"}}>
      {msg}
    </div>
  ) : null;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Av({name,size=40}) {
  const {bg,c}=avatarBg(name);
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.33,fontWeight:500,color:c,flexShrink:0}}>{initials(name)}</div>;
}

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({lead,onOpen,onWA,onCall,onSummary}) {
  const u=calcUrgency(lead);
  const urg=URGENCY[u.level];
  const sc=STATUS_CONFIG[lead.status];
  return (
    <div style={{...g.card,borderRight:`4px solid ${urg.border}`}} onClick={()=>onOpen(lead)}>
      {u.label && <div style={{fontSize:10,fontWeight:500,background:urg.labelBg,color:urg.labelColor,borderRadius:10,padding:"2px 9px",display:"inline-block",marginBottom:7}}>{u.level==="fire"?"🔴 ":u.level==="warm"?"🟡 ":"🔵 "}{u.label}</div>}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <Av name={lead.name}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",marginBottom:2}}>{lead.name}</div>
          <div style={{fontSize:12,color:"var(--color-text-secondary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.address}{lead.price?` · ₪${lead.price}`:""}</div>
        </div>
        <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:500,background:sc.bg,color:sc.color,flexShrink:0}}>{sc.label}</span>
      </div>
      {lead.meetingSummary && (
        <div style={{fontSize:11,background:"#EEEDFE",color:"#534AB7",borderRadius:8,padding:"4px 9px",marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <i className="ti ti-sparkles" style={{fontSize:11}} aria-hidden="true"/>
          סיכום פגישה נשמר · {["low","medium","high"].includes(lead.meetingSummary.agreeLevel)&&{low:"מתנגד",medium:"מתלבט",high:"מעוניין מאוד"}[lead.meetingSummary.agreeLevel]}
        </div>
      )}
      {lead.reminder && <div style={{fontSize:12,color:"#6B4F00",background:"#FFFBEA",borderRadius:8,padding:"5px 9px",marginBottom:8,display:"flex",gap:5}}><span>📌</span>{lead.reminder}</div>}
      <div style={{display:"flex",gap:7,paddingTop:8,borderTop:"0.5px solid var(--color-border-tertiary)"}} onClick={e=>e.stopPropagation()}>
        <button style={{...g.bigBtn,background:"#EAF3DE",color:"#3B6D11"}} onClick={()=>onWA(lead)}><i className="ti ti-brand-whatsapp" style={{fontSize:16}} aria-hidden="true"/> ווצאפ</button>
        <button style={{...g.bigBtn,background:"#E6F1FB",color:"#185FA5"}} onClick={()=>onCall(lead.phone)}><i className="ti ti-phone" style={{fontSize:16}} aria-hidden="true"/> התקשר</button>
        {(lead.status==="meeting"||lead.status==="after_meet")&&onSummary&&(
          <button style={{...g.iconBtn,background:"#FBEAF0",color:"#72243E"}} onClick={e=>{e.stopPropagation();onSummary(lead);}} title="סכם פגישה"><i className="ti ti-report" aria-hidden="true"/></button>
        )}
        <button style={{...g.iconBtn,background:"var(--color-background-secondary)",color:"var(--color-text-secondary)"}} onClick={()=>onOpen(lead)}><i className="ti ti-chevron-left" aria-hidden="true"/></button>
      </div>
    </div>
  );
}

// ─── Today Screen ─────────────────────────────────────────────────────────────
function TodayScreen({leads,onOpen,onWA,onCall,onSummary}) {
  const fire=leads.filter(l=>calcUrgency(l).level==="fire"&&!["signed","lost"].includes(l.status));
  const warm=leads.filter(l=>calcUrgency(l).level==="warm");
  const cool=leads.filter(l=>["cool","cold"].includes(calcUrgency(l).level)&&!["signed","lost"].includes(l.status));
  const today=new Date().toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"});
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={g.topbar}>
        <div>
          <div style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>היום שלי</div>
          <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{today}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {fire.length>0&&<div style={{background:"#D85A30",color:"white",borderRadius:20,padding:"3px 11px",fontSize:12,fontWeight:500}}>{fire.length} דחוף</div>}
        </div>
      </div>
      <div style={g.screen}>
        <div style={{padding:"0 14px"}}>
          {fire.length>0&&<><div style={{...g.section,color:"#D85A30"}}>🔴 דחוף — עכשיו ({fire.length})</div>{fire.map(l=><LeadCard key={l.id} lead={l} onOpen={onOpen} onWA={onWA} onCall={onCall} onSummary={onSummary}/>)}</>}
          {warm.length>0&&<><div style={{...g.section,color:"#854F0B"}}>🟡 השבוע ({warm.length})</div>{warm.map(l=><LeadCard key={l.id} lead={l} onOpen={onOpen} onWA={onWA} onCall={onCall} onSummary={onSummary}/>)}</>}
          {cool.length>0&&(
            <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,border:"0.5px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",gap:10,marginTop:6}}>
              <i className="ti ti-moon" style={{fontSize:22,color:"var(--color-text-tertiary)"}} aria-hidden="true"/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:"var(--color-text-primary)",fontWeight:500}}>{cool.length} לידים עתידיים</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>לא דחוף להיום</div>
              </div>
            </div>
          )}
          {fire.length===0&&warm.length===0&&<div style={{textAlign:"center",padding:"60px 20px",color:"var(--color-text-tertiary)"}}><div style={{fontSize:40,marginBottom:12}}>✅</div><div style={{fontSize:15,fontWeight:500}}>כל הפולואפים טופלו!</div></div>}
        </div>
      </div>
    </div>
  );
}

// ─── Leads Screen ─────────────────────────────────────────────────────────────
function LeadsScreen({leads,onOpen,onWA,onCall,onAddContact,onSummary}) {
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const filters=[{k:"all",l:"הכל"},{k:"fire",l:"🔴 דחוף"},{k:"new",l:"ליד חדש"},{k:"contact",l:"נוצר קשר"},{k:"meeting",l:"פגישה"},{k:"after_meet",l:"לאחר פגישה"},{k:"signed",l:"גויס"},{k:"excl_other",l:"🔒 אצל אחר"}];
  const visible=leads.filter(l=>{
    if(search&&!l.name.includes(search)&&!(l.address||"").includes(search)) return false;
    if(filter==="all") return true;
    if(filter==="fire") return calcUrgency(l).level==="fire";
    return l.status===filter;
  }).sort((a,b)=>calcUrgency(b).score-calcUrgency(a).score);
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={g.topbar}>
        <span style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>לידים <span style={{fontSize:12,color:"var(--color-text-tertiary)",fontWeight:400}}>({leads.length})</span></span>
        <button onClick={onAddContact} style={{background:"#EAF3DE",color:"#3B6D11",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontWeight:500}}>
          <i className="ti ti-address-book" style={{fontSize:15}} aria-hidden="true"/> מאנשי קשר
        </button>
      </div>
      <div style={{padding:"10px 14px 0",background:"var(--color-background-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
        <input style={{...g.inp,fontSize:13,padding:"9px 12px",marginBottom:10}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 חיפוש לפי שם או כתובת"/>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,WebkitOverflowScrolling:"touch"}}>
          {filters.map(f=><button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,border:`0.5px solid ${filter===f.k?"#AFA9EC":"var(--color-border-tertiary)"}`,background:filter===f.k?"#EEEDFE":"var(--color-background-primary)",color:filter===f.k?"#534AB7":"var(--color-text-secondary)",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{f.l}</button>)}
        </div>
      </div>
      <div style={g.screen}>
        <div style={{padding:"10px 14px"}}>
          {visible.length===0&&<div style={{textAlign:"center",padding:"50px 20px",color:"var(--color-text-tertiary)",fontSize:14}}>אין לידים להצגה</div>}
          {visible.map(l=><LeadCard key={l.id} lead={l} onOpen={onOpen} onWA={onWA} onCall={onCall} onSummary={onSummary}/>)}
        </div>
      </div>
    </div>
  );
}


// ─── Meeting Summary Screen ───────────────────────────────────────────────────
function MeetingSummaryScreen({lead,onBack,onSave,showToast}) {
  const [agree,setAgree]=useState(lead.meetingSummary?.agreeLevel||"medium");
  const [positives,setPositives]=useState(lead.meetingSummary?.positives||"");
  const [concerns,setConcerns]=useState(lead.meetingSummary?.concerns||"");
  const [extra,setExtra]=useState(lead.meetingSummary?.extraNotes||"");
  const [aiMsg,setAiMsg]=useState("");
  const [loading,setLoading]=useState(false);

  const agreeOpts=[
    {k:"low",  l:"מתנגד",      bg:"#FAECE7",c:"#993C1D",border:"#993C1D"},
    {k:"medium",l:"מתלבט",     bg:"#EEEDFE",c:"#534AB7",border:"#534AB7"},
    {k:"high", l:"מעוניין מאוד",bg:"#EAF3DE",c:"#3B6D11",border:"#3B6D11"},
  ];

  const generate=async()=>{
    if(!positives&&!concerns&&!extra){showToast("מלא לפחות שדה אחד");return;}
    setLoading(true);
    try{
      const agreeLabel={low:"מתנגד/לא בטוח",medium:"מתלבט",high:"מעוניין מאוד"}[agree];
      const prompt=`אתה מסייע למתווך נדל"ן לכתוב הודעת ווצאפ לאחר פגישה עם מוכר.

שם: ${lead.name}
נכס: ${lead.address}${lead.rooms?" · "+lead.rooms+" חדרים":""}${lead.price?" · ₪"+lead.price:""}
תאריך פגישה: ${formatDate(lead.meetingDate)||"היום"}
רמת עניין: ${agreeLabel}
חיובי: ${positives||"לא צוין"}
חששות: ${concerns||"לא צוין"}
הערות: ${extra||"אין"}

כתוב הודעת ווצאפ קצרה, אישית וחמה בעברית — מסכמת את הפגישה, מתייחסת לנקודות הספציפיות, ומניעה לחתימת בלעדיות. טבעית, ללא כותרות, עד 100 מילים.`;

      const r=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,messages:[{role:"user",content:prompt}]})
      });
      const d=await r.json();
      setAiMsg(d.content?.map(b=>b.text||"").join("")?.trim()||"שגיאה — נסה שוב");
    }catch(e){setAiMsg("שגיאה בחיבור — נסה שוב");}
    setLoading(false);
  };

  const sendWA=()=>{
    onSave({agreeLevel:agree,positives,concerns,extraNotes:extra},aiMsg);
    openWA(lead.phone,aiMsg);
    onBack();
    showToast("ווצאפ נשלח ✓");
  };
  const saveOnly=()=>{
    onSave({agreeLevel:agree,positives,concerns,extraNotes:extra},aiMsg);
    onBack();
    showToast("סיכום נשמר ✓");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{...g.topbar}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:22,padding:0,display:"flex"}}><i className="ti ti-arrow-right" aria-hidden="true"/></button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)"}}>סיכום פגישה</div>
          <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{lead.name} · {lead.address}</div>
        </div>
        <div style={{width:32}}/>
      </div>
      <div style={g.screen}>
        <div style={{padding:"14px"}}>

          {/* Agree level */}
          <div style={{marginBottom:14}}>
            <label style={{...g.lbl,fontSize:13,fontWeight:500,color:"var(--color-text-primary)",marginBottom:10}}>רמת עניין המוכר בבלעדיות</label>
            <div style={{display:"flex",gap:8}}>
              {agreeOpts.map(o=>(
                <button key={o.k} onClick={()=>setAgree(o.k)} style={{flex:1,padding:"12px 6px",borderRadius:12,border:`2px solid ${agree===o.k?o.border:"var(--color-border-tertiary)"}`,background:agree===o.k?o.bg:"var(--color-background-primary)",color:agree===o.k?o.c:"var(--color-text-secondary)",cursor:"pointer",fontSize:12,fontWeight:agree===o.k?500:400,transition:"all .15s"}}>
                  {agree===o.k&&<div style={{fontSize:16,marginBottom:4}}>{o.k==="high"?"😊":o.k==="medium"?"🤔":"😐"}</div>}
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Positives */}
          <div style={{marginBottom:12}}>
            <label style={g.lbl}><i className="ti ti-thumb-up" style={{fontSize:13,marginLeft:4,color:"#3B6D11"}} aria-hidden="true"/>נקודות חיוביות שעלו</label>
            <textarea style={{...g.inp,height:76,resize:"none",lineHeight:1.5}} value={positives} onChange={e=>setPositives(e.target.value)} placeholder="רוצה למכור מהר, גמיש במחיר, נכס מטופח..."/>
          </div>

          {/* Concerns */}
          <div style={{marginBottom:12}}>
            <label style={g.lbl}><i className="ti ti-alert-triangle" style={{fontSize:13,marginLeft:4,color:"#D85A30"}} aria-hidden="true"/>חששות / התנגדויות</label>
            <textarea style={{...g.inp,height:76,resize:"none",lineHeight:1.5}} value={concerns} onChange={e=>setConcerns(e.target.value)} placeholder="לא בטוח בבלעדיות, צריך להתייעץ עם בת הזוג..."/>
          </div>

          {/* Extra */}
          <div style={{marginBottom:16}}>
            <label style={g.lbl}>הערות נוספות</label>
            <textarea style={{...g.inp,height:56,resize:"none"}} value={extra} onChange={e=>setExtra(e.target.value)} placeholder="כל פרט נוסף שחשוב לזכור..."/>
          </div>

          {/* Generate */}
          <button onClick={generate} disabled={loading} style={{width:"100%",background:loading?"#AFA9EC":"#534AB7",color:"white",border:"none",borderRadius:14,padding:"14px",cursor:loading?"not-allowed":"pointer",fontSize:15,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14,transition:"background .2s"}}>
            {loading
              ? <><i className="ti ti-loader" style={{fontSize:18,animation:"spin 1s linear infinite"}} aria-hidden="true"/> יוצר הודעה...</>
              : <><i className="ti ti-sparkles" style={{fontSize:18}} aria-hidden="true"/> צור ווצאפ עם AI</>
            }
          </button>

          {/* AI result */}
          {aiMsg&&(
            <div style={{background:"#EEEDFE",border:"1.5px solid #AFA9EC",borderRadius:16,padding:14,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:500,color:"#534AB7",display:"flex",alignItems:"center",gap:5}}>
                  <i className="ti ti-sparkles" style={{fontSize:13}} aria-hidden="true"/>הודעה שנוצרה
                </span>
                <button onClick={()=>{navigator.clipboard?.writeText(aiMsg);showToast("הועתק ✓");}} style={{background:"white",border:"0.5px solid #AFA9EC",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#534AB7"}}>
                  <i className="ti ti-copy" style={{fontSize:12}} aria-hidden="true"/> העתק
                </button>
              </div>
              <textarea style={{...g.inp,height:130,resize:"none",background:"white",fontSize:13,lineHeight:1.6,border:"none"}} value={aiMsg} onChange={e=>setAiMsg(e.target.value)}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={sendWA} style={{flex:1,background:"#3B6D11",color:"white",border:"none",borderRadius:12,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <i className="ti ti-brand-whatsapp" style={{fontSize:18}} aria-hidden="true"/> שלח עכשיו
                </button>
                <button onClick={saveOnly} style={{background:"var(--color-background-primary)",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:12,padding:"13px 16px",cursor:"pointer",fontSize:13}}>
                  שמור בלי לשלוח
                </button>
              </div>
            </div>
          )}

          {/* Save without AI */}
          {!aiMsg&&(
            <button onClick={saveOnly} style={{width:"100%",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:14,padding:"12px",cursor:"pointer",fontSize:13}}>
              שמור סיכום בלי לשלוח
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Lead Detail Screen ───────────────────────────────────────────────────────
function LeadDetailScreen({lead,onBack,onUpdate,onDelete,onWA,onCall,onSummary,showToast}) {
  const [note,setNote]=useState("");
  const [editReminder,setEditReminder]=useState(lead.reminder||"");
  const [followUpDate,setFollowUpDate]=useState(lead.followUpDate||"");
  const [followUpNote,setFollowUpNote]=useState(lead.followUpNote||"");
  const [meetDate,setMeetDate]=useState(lead.meetingDate||"");
  const [meetTime,setMeetTime]=useState(lead.meetingTime||"");
  const u=calcUrgency(lead);
  const urg=URGENCY[u.level];
  const sc=STATUS_CONFIG[lead.status];

  const saveNote=()=>{
    if(!note.trim()) return;
    const entry={date:new Date().toISOString().slice(0,10),type:"note",text:note};
    onUpdate({...lead,timeline:[entry,...lead.timeline]});
    setNote(""); showToast("הערה נשמרה ✓");
  };
  const saveFollowUp=()=>{
    const entry={date:new Date().toISOString().slice(0,10),type:"note",text:`פולואפ נקבע ל-${formatDate(followUpDate)} — ${followUpNote}`};
    onUpdate({...lead,followUpDate,followUpNote,reminder:editReminder,timeline:followUpDate?[entry,...lead.timeline]:lead.timeline});
    showToast("נשמר ✓");
  };
  const saveMeeting=()=>{
    const entry={date:new Date().toISOString().slice(0,10),type:"meeting",text:`פגישה נקבעת ל-${formatDate(meetDate)} ${meetTime}`};
    onUpdate({...lead,meetingDate:meetDate,meetingTime:meetTime,status:"meeting",timeline:[entry,...lead.timeline]});
    showToast("פגישה נשמרה ✓");
  };
  const [exStart,setExStart]=useState(lead.exclusiveStart||"");
  const [exEnd,setExEnd]=useState(lead.exclusiveEnd||"");
  const saveExclusive=()=>{
    const entry={date:new Date().toISOString().slice(0,10),type:"signed",text:`בלעדיות: ${formatDate(exStart)} — ${formatDate(exEnd)}`};
    onUpdate({...lead,exclusiveStart:exStart,exclusiveEnd:exEnd,status:"signed",timeline:[entry,...lead.timeline]});
    showToast("בלעדיות נשמרה ✓");
  };
  const handleExclusiveOther=()=>{
    const newDate=addMonths(new Date().toISOString().slice(0,10), 3);
    const entry={date:new Date().toISOString().slice(0,10),type:"note",text:`בלעדיות אצל מתווך אחר — פולואפ נדחה ל-${formatDate(newDate)}`};
    onUpdate({...lead,status:"excl_other",followUpDate:newDate,followUpNote:"בלעדיות אצל מתווך אחר",reminder:`לחזור ב-${formatDate(newDate)} — בלעדיות פגה`,timeline:[entry,...lead.timeline]});
    showToast("פולואפ נדחה 3 חודשים ✓");
  };
  const handleDelete=()=>{
    if(window.confirm("למחוק את הליד? הדירה כבר נמכרה.")){
      onDelete(lead.id);
    }
  };
  const setStatus=s=>{
    const today=new Date().toISOString().slice(0,10);
    const entry={date:today,type:"note",text:`סטטוס עודכן: ${STATUS_CONFIG[s]?.label||s}`};
    let extra={};
    // Auto-set followup when moving to key statuses
    if(s==="after_meet" && !lead.followUpDate) extra={followUpDate:addMonths(today,0),followUpNote:"פולואפ לאחר פגישה"};
    if(s==="contact"    && !lead.followUpDate) extra={followUpDate:addMonths(today,0),followUpNote:"לתאם פגישה"};
    if(s==="excl_other")                       extra={followUpDate:addMonths(today,3),followUpNote:"בלעדיות אצל מתווך אחר"};
    if(["signed","lost"].includes(s))          extra={followUpDate:"",followUpNote:""};
    onUpdate({...lead,status:s,...extra,timeline:[entry,...lead.timeline]});
    showToast("סטטוס עודכן ✓");
  };
  const addToCalendar=()=>{
    if(!meetDate||!meetTime){showToast("הזן תאריך ושעה קודם");return;}
    const [h,m]=meetTime.split(":").map(Number);
    const p=n=>String(n).padStart(2,"0");
    const b=meetDate.replace(/-/g,"");
    const url=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`פגישה עם ${lead.name}`)}&dates=${b}T${p(h)}${p(m)}00/${b}T${p(h+1)}${p(m)}00&details=${encodeURIComponent(`${lead.name}\n${lead.phone}\n${lead.address}`)}&location=${encodeURIComponent(lead.address||"")}`;
    window.open(url,"_blank");
  };

  const TIMELINE_ICONS={new:"ti-user-plus",call:"ti-phone",whatsapp:"ti-brand-whatsapp",meeting:"ti-calendar",signed:"ti-file-check",note:"ti-notes",after_meet:"ti-report"};
  const TIMELINE_COLORS={new:"#B4B2A9",call:"#85B7EB",whatsapp:"#97C459",meeting:"#EF9F27",signed:"#5DCAA5",note:"#AFA9EC",after_meet:"#ED93B1"};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{...g.topbar,gap:10}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:22,padding:0,display:"flex"}}><i className="ti ti-arrow-right" aria-hidden="true"/></button>
        <span style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)",flex:1}}>{lead.name}</span>
        <button onClick={()=>onWA(lead)} style={{background:"#EAF3DE",color:"#3B6D11",border:"none",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-brand-whatsapp" style={{fontSize:15}} aria-hidden="true"/></button>
        <button onClick={()=>onCall(lead.phone)} style={{background:"#E6F1FB",color:"#185FA5",border:"none",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-phone" style={{fontSize:15}} aria-hidden="true"/></button>
      </div>
      <div style={g.screen}>
        <div style={{padding:"14px 14px"}}>

          {/* Hero */}
          <div style={{background:"var(--color-background-primary)",borderRadius:16,padding:16,marginBottom:12,border:"0.5px solid var(--color-border-tertiary)",textAlign:"center"}}>
            <div style={{margin:"0 auto 10px"}}><Av name={lead.name} size={56}/></div>
            <div style={{fontSize:18,fontWeight:500,color:"var(--color-text-primary)",marginBottom:2}}>{lead.name}</div>
            <div style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:8}}>{lead.phone}</div>
            <span style={{fontSize:11,padding:"4px 12px",borderRadius:20,fontWeight:500,background:sc.bg,color:sc.color}}>{sc.label}</span>
            {u.label&&<div style={{marginTop:8,background:urg.labelBg,borderRadius:8,padding:"5px 10px",fontSize:11,color:urg.labelColor,fontWeight:500}}>{u.label}</div>}
          </div>

          {/* Action grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[
              {label:"ווצאפ",icon:"ti-brand-whatsapp",bg:"#EAF3DE",color:"#3B6D11",fn:()=>onWA(lead)},
              {label:"התקשר",icon:"ti-phone",bg:"#E6F1FB",color:"#185FA5",fn:()=>onCall(lead.phone)},
              {label:"סכם פגישה",icon:"ti-report",bg:"#FBEAF0",color:"#72243E",fn:()=>onSummary(lead)},
              {label:"ליומן גוגל",icon:"ti-brand-google",bg:"#FAECE7",color:"#C5221F",fn:addToCalendar},
            ].map(b=>(
              <button key={b.label} onClick={b.fn} style={{background:b.bg,color:b.color,border:"none",borderRadius:14,padding:"14px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <i className={`ti ${b.icon}`} style={{fontSize:24}} aria-hidden="true"/>
                <span style={{fontSize:12,fontWeight:500}}>{b.label}</span>
              </button>
            ))}
          </div>

          {/* Property */}
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,marginBottom:12,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,marginBottom:8}}>פרטי הנכס</div>
            {[
              {icon:"ti-home",text:lead.address},
              {icon:"ti-door",text:lead.rooms?`${lead.rooms} חדרים${lead.price?` · ₪${lead.price}`:""}`:lead.price?`₪${lead.price}`:null},
              {icon:"ti-speakerphone",text:`מקור: ${lead.source}`},
              lead.meetingDate&&{icon:"ti-calendar",text:`פגישה: ${formatDate(lead.meetingDate)} ${lead.meetingTime}`},
            ].filter(Boolean).map((row,i)=>row.text&&(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--color-text-primary)",marginBottom:6}}>
                <i className={`ti ${row.icon}`} style={{fontSize:16,color:"var(--color-text-secondary)",flexShrink:0}} aria-hidden="true"/>
                {row.text}
              </div>
            ))}
          </div>

          {/* Reminder + followup */}
          <div style={{background:"#FFFBEA",border:"0.5px solid #EFC94C",borderRadius:14,padding:14,marginBottom:12}}>
            <div style={{fontSize:11,color:"#8A6200",fontWeight:500,marginBottom:8}}>📌 תזכורת ויעד פולואפ</div>
            <textarea style={{...g.inp,height:52,resize:"none",background:"transparent",border:"0.5px solid #EFC94C",fontSize:13,marginBottom:10}} value={editReminder} onChange={e=>setEditReminder(e.target.value)} placeholder="מה אמר המוכר? מה חשוב לזכור?"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><label style={{...g.lbl,color:"#8A6200"}}>מתי לחזור</label><input type="date" style={{...g.inp,fontSize:13}} value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)}/></div>
              <div><label style={{...g.lbl,color:"#8A6200"}}>מה אמר</label><input style={{...g.inp,fontSize:13}} value={followUpNote} onChange={e=>setFollowUpNote(e.target.value)} placeholder='"נסה חודשיים"'/></div>
            </div>
            <button onClick={saveFollowUp} style={{width:"100%",background:"#EFC94C",color:"#4A3500",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:500}}>שמור תזכורת</button>
          </div>

          {/* Status */}
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,marginBottom:12,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,marginBottom:10}}>עדכן סטטוס</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {k:"new",       desc:"טרם נוצר קשר"},
                {k:"contact",   desc:"דיברנו, ממתין לפגישה"},
                {k:"meeting",   desc:"פגישה נקבעה בלוח"},
                {k:"after_meet",desc:"הייתי בפגישה, בפולואפ"},
                {k:"followup",  desc:"בתהליך מתקדם"},
                {k:"signing",   desc:"ממתין לחתימה"},
                {k:"signed",    desc:"חוזה נחתם ✓"},
                {k:"excl_other",desc:"בלעדיות אצל מתווך אחר"},
                {k:"lost",      desc:"לא רלוונטי יותר"},
              ].map(({k,desc})=>{
                const v=STATUS_CONFIG[k];
                const active=lead.status===k;
                return(
                  <button key={k} onClick={()=>setStatus(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`0.5px solid ${active?v.color:"var(--color-border-tertiary)"}`,background:active?v.bg:"transparent",cursor:"pointer",textAlign:"right"}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:v.color,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:active?500:400,color:active?v.color:"var(--color-text-primary)"}}>{v.label}</div>
                      <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:1}}>{desc}</div>
                    </div>
                    {active&&<i className="ti ti-check" style={{fontSize:16,color:v.color,flexShrink:0}} aria-hidden="true"/>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exclusive dates — shown when signed */}
          {lead.status==="signed"&&(
            <div style={{background:"#E1F5EE",border:"1px solid #5DCAA5",borderRadius:14,padding:14,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:500,color:"#085041",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <i className="ti ti-file-check" style={{fontSize:16}} aria-hidden="true"/>תקופת בלעדיות
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div><label style={{...g.lbl,color:"#085041"}}>תאריך תחילה</label><input type="date" style={{...g.inp,border:"0.5px solid #5DCAA5"}} value={exStart} onChange={e=>setExStart(e.target.value)}/></div>
                <div><label style={{...g.lbl,color:"#085041"}}>תאריך סיום</label><input type="date" style={{...g.inp,border:"0.5px solid #5DCAA5"}} value={exEnd} onChange={e=>setExEnd(e.target.value)}/></div>
              </div>
              {exEnd&&(()=>{
                const days=Math.floor((new Date(exEnd)-new Date())/86400000);
                return days<=7&&days>=0?(
                  <div style={{fontSize:11,background:"#FAEEDA",color:"#854F0B",borderRadius:8,padding:"5px 9px",marginBottom:8,fontWeight:500}}>⚠️ בלעדיות פגה בעוד {days} ימים</div>
                ):days<0?(
                  <div style={{fontSize:11,background:"#F1EFE8",color:"#5F5E5A",borderRadius:8,padding:"5px 9px",marginBottom:8}}>בלעדיות פגה לפני {Math.abs(days)} ימים</div>
                ):null;
              })()}
              <button onClick={saveExclusive} style={{width:"100%",background:"#0F6E56",color:"white",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:500}}>שמור תקופת בלעדיות</button>
            </div>
          )}

          {/* Special actions */}
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,marginBottom:12,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,marginBottom:8}}>פעולות מיוחדות</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={handleExclusiveOther} style={{width:"100%",background:"#F1EFE8",color:"#5F5E5A",border:"0.5px solid var(--color-border-secondary)",borderRadius:12,padding:"12px 14px",cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"right"}}>
                <i className="ti ti-lock" style={{fontSize:18,color:"#888780",flexShrink:0}} aria-hidden="true"/>
                <div>
                  <div>בלעדיות אצל מתווך אחר</div>
                  <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:400,marginTop:2}}>מזיז פולואפ 3 חודשים קדימה אוטומטית</div>
                </div>
              </button>
              <button onClick={handleDelete} style={{width:"100%",background:"#FCEBEB",color:"#A32D2D",border:"0.5px solid #F09595",borderRadius:12,padding:"12px 14px",cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,textAlign:"right"}}>
                <i className="ti ti-trash" style={{fontSize:18,flexShrink:0}} aria-hidden="true"/>
                <div>
                  <div>הדירה נמכרה — מחק ליד</div>
                  <div style={{fontSize:11,color:"#D85A30",fontWeight:400,marginTop:2}}>פעולה זו לא ניתנת לביטול</div>
                </div>
              </button>
            </div>
          </div>

          {/* Meeting */}
          <div style={{background:"var(--color-background-secondary)",borderRadius:14,padding:14,marginBottom:12}}>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,marginBottom:8}}>קביעת פגישה</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><label style={g.lbl}>תאריך</label><input type="date" style={g.inp} value={meetDate} onChange={e=>setMeetDate(e.target.value)}/></div>
              <div><label style={g.lbl}>שעה</label><input type="time" style={g.inp} value={meetTime} onChange={e=>setMeetTime(e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={saveMeeting} style={{flex:1,background:"#EEEDFE",color:"#534AB7",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:500}}>שמור פגישה</button>
              <button onClick={addToCalendar} style={{flex:1,background:"#FAECE7",color:"#C5221F",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><i className="ti ti-brand-google" style={{fontSize:14}} aria-hidden="true"/>הוסף ליומן</button>
            </div>
          </div>

          {/* Note */}
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,marginBottom:12,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,marginBottom:8}}>הוסף הערה מהירה</div>
            <textarea style={{...g.inp,height:72,resize:"none",marginBottom:8}} value={note} onChange={e=>setNote(e.target.value)} placeholder="מה קרה בשיחה? מה אמר המוכר?"/>
            <button onClick={saveNote} style={{width:"100%",background:"#534AB7",color:"white",border:"none",borderRadius:10,padding:"11px",cursor:"pointer",fontSize:14,fontWeight:500}}>שמור הערה</button>
          </div>

          {/* Timeline */}
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,marginBottom:10}}>היסטוריה</div>
            {lead.timeline.map((item,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:(TIMELINE_COLORS[item.type]||"#ccc")+"33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className={`ti ${TIMELINE_ICONS[item.type]||"ti-circle"}`} style={{fontSize:13,color:TIMELINE_COLORS[item.type]||"#999"}} aria-hidden="true"/>
                </div>
                <div>
                  <div style={{fontSize:13,color:"var(--color-text-primary)"}}>{item.text}</div>
                  <div style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{formatDate(item.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Lead Screen ──────────────────────────────────────────────────────────
function AddLeadScreen({onBack,onAdd,prefill=null,existingLeads=[],onOpenExisting}) {
  const [f,setF]=useState(prefill||{name:"",phone:"",address:"",rooms:"",price:"",source:"המלצה",notes:"",reminder:"",followUpDate:"",followUpNote:"",exclusiveStart:"",exclusiveEnd:"",soldDate:""});
  const [errors,setErrors]=useState({});
  const set=(k,v)=>{setF(p=>({...p,[k]:v}));if(errors[k])setErrors(e=>({...e,[k]:null}));};
  const sources=["המלצה","פייסבוק","שילוט","יד2","גוגל","ישיר","אחר"];

  const REQUIRED=["name","phone","address"];

  // Duplicate detection by phone number
  const duplicate = f.phone && f.phone.replace(/\D/g,"").length>=7
    ? existingLeads.find(l=>normalizePhone(l.phone)===normalizePhone(f.phone) && l.id!==f.id)
    : null;

  const handle=()=>{
    const newErrors={};
    REQUIRED.forEach(k=>{ if(!f[k]||!f[k].toString().trim()) newErrors[k]="שדה חובה"; });
    if(f.rooms && isNaN(parseFloat(f.rooms))) newErrors.rooms="יש להזין מספר";
    if(f.price && isNaN(parseFloat(f.price.toString().replace(/,/g,"")))) newErrors.price="יש להזין מספר";
    if(Object.keys(newErrors).length>0){ setErrors(newErrors); return; }
    onAdd({...f,id:Date.now(),status:"new",meetingDate:"",meetingTime:"",meetingSummary:null,timeline:[{date:new Date().toISOString().slice(0,10),type:"new",text:"נוסף למערכת"}]});
  };
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{...g.topbar}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"#D85A30",fontSize:14}}>ביטול</button>
        <span style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>ליד חדש</span>
        <button onClick={handle} style={{background:"none",border:"none",cursor:"pointer",color:"#534AB7",fontSize:14,fontWeight:500}}>שמור</button>
      </div>
      <div style={g.screen}>
        <div style={{padding:"16px 14px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#E6F1FB",border:"0.5px solid #85B7EB",borderRadius:12,padding:"10px 12px",fontSize:12,color:"#0C447C",lineHeight:1.6,display:"flex",gap:8}}>
            <i className="ti ti-info-circle" style={{fontSize:16,flexShrink:0,marginTop:1}} aria-hidden="true"/>
            <span>טיפ: באנשי הקשר, העתק שם או טלפון (לחיצה ארוכה → העתק), ולחץ <i className="ti ti-clipboard" style={{fontSize:13}} aria-hidden="true"/> כדי להדביק כאן</span>
          </div>
          {Object.keys(errors).length>0&&(
            <div style={{background:"#FCEBEB",border:"0.5px solid #F09595",borderRadius:12,padding:"10px 12px",fontSize:12,color:"#A32D2D",lineHeight:1.6,display:"flex",gap:8}}>
              <i className="ti ti-alert-circle" style={{fontSize:16,flexShrink:0,marginTop:1}} aria-hidden="true"/>
              <span>יש לתקן {Object.keys(errors).length} שדות מסומנים באדום לפני השמירה</span>
            </div>
          )}
          {[["name","שם המוכר","text"],["phone","טלפון","tel"]].map(([k,l,t])=>(
            <div key={k}>
              <label style={g.lbl}>{l} <span style={{color:"#D85A30"}}>*</span></label>
              <div style={{display:"flex",gap:8}}>
                <input style={{...g.inp,flex:1,border:errors[k]?"1.5px solid #D85A30":g.inp.border}} type={t} value={f[k]} onChange={e=>set(k,e.target.value)} placeholder={l}/>
                <button onClick={async()=>{
                  try{
                    const text=await navigator.clipboard.readText();
                    if(text) set(k,text.trim());
                  }catch(e){}
                }} style={{...g.iconBtn,background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",flexShrink:0}} title="הדבק מהלוח">
                  <i className="ti ti-clipboard" aria-hidden="true"/>
                </button>
              </div>
              {errors[k]&&<div style={{fontSize:11,color:"#D85A30",marginTop:4,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-alert-circle" style={{fontSize:12}} aria-hidden="true"/>{errors[k]}</div>}
            </div>
          ))}

          {duplicate&&(
            <div style={{background:"#FAEEDA",border:"1px solid #EF9F27",borderRadius:12,padding:12}}>
              <div style={{fontSize:12,color:"#633806",fontWeight:500,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <i className="ti ti-alert-triangle" style={{fontSize:15}} aria-hidden="true"/>
                ליד עם הטלפון הזה כבר קיים במערכת
              </div>
              <div style={{background:"var(--color-background-primary)",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <Av name={duplicate.name} size={36}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>{duplicate.name}</div>
                  <div style={{fontSize:11,color:"var(--color-text-secondary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{duplicate.address||"—"}</div>
                </div>
                <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:500,background:STATUS_CONFIG[duplicate.status]?.bg,color:STATUS_CONFIG[duplicate.status]?.color}}>{STATUS_CONFIG[duplicate.status]?.label}</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>onOpenExisting(duplicate)} style={{flex:1,background:"#534AB7",color:"white",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:500}}>
                  פתח את הליד הקיים
                </button>
              </div>
              <div style={{fontSize:11,color:"#854F0B",marginTop:8,textAlign:"center"}}>או המשך למלא אם זה ליד אחר עם אותו מספר</div>
            </div>
          )}
          <div>
            <label style={g.lbl}>כתובת הנכס <span style={{color:"#D85A30"}}>*</span></label>
            <input style={{...g.inp,border:errors.address?"1.5px solid #D85A30":g.inp.border}} value={f.address} onChange={e=>set("address",e.target.value)} placeholder="רח' ..., עיר"/>
            {errors.address&&<div style={{fontSize:11,color:"#D85A30",marginTop:4,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-alert-circle" style={{fontSize:12}} aria-hidden="true"/>{errors.address}</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={g.lbl}>חדרים</label>
              <input style={{...g.inp,border:errors.rooms?"1.5px solid #D85A30":g.inp.border}} type="text" inputMode="decimal" value={f.rooms} onChange={e=>set("rooms",e.target.value)} placeholder="3.5"/>
              {errors.rooms&&<div style={{fontSize:11,color:"#D85A30",marginTop:4,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-alert-circle" style={{fontSize:12}} aria-hidden="true"/>{errors.rooms}</div>}
            </div>
            <div>
              <label style={g.lbl}>מחיר (₪)</label>
              <input style={{...g.inp,border:errors.price?"1.5px solid #D85A30":g.inp.border}} type="text" inputMode="numeric" value={f.price} onChange={e=>set("price",e.target.value)} placeholder="2,500,000"/>
              {errors.price&&<div style={{fontSize:11,color:"#D85A30",marginTop:4,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-alert-circle" style={{fontSize:12}} aria-hidden="true"/>{errors.price}</div>}
            </div>
          </div>
          <div>
            <label style={g.lbl}>מקור ליד</label>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {sources.map(s=><button key={s} onClick={()=>set("source",s)} style={{padding:"8px 14px",borderRadius:20,fontSize:13,cursor:"pointer",border:"none",background:f.source===s?"#534AB7":"var(--color-background-secondary)",color:f.source===s?"white":"var(--color-text-secondary)",fontWeight:f.source===s?500:400}}>{s}</button>)}
            </div>
          </div>
          <div style={{background:"#FFFBEA",border:"0.5px solid #EFC94C",borderRadius:14,padding:14}}>
            <label style={{...g.lbl,color:"#8A6200"}}>📌 מה אמר / מתי לחזור</label>
            <input style={{...g.inp,border:"0.5px solid #EFC94C",marginBottom:10}} value={f.reminder} onChange={e=>set("reminder",e.target.value)} placeholder='"נסה חודשיים לבד"'/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={{...g.lbl,color:"#8A6200"}}>תאריך לחזור</label><input type="date" style={{...g.inp,border:"0.5px solid #EFC94C"}} value={f.followUpDate} onChange={e=>set("followUpDate",e.target.value)}/></div>
              <div><label style={{...g.lbl,color:"#8A6200"}}>הערת פולואפ</label><input style={{...g.inp,border:"0.5px solid #EFC94C"}} value={f.followUpNote} onChange={e=>set("followUpNote",e.target.value)} placeholder="פרטים..."/></div>
            </div>
          </div>
          <div><label style={g.lbl}>הערות</label><textarea style={{...g.inp,height:72,resize:"none"}} value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="פרטים נוספים..."/></div>
          <button onClick={handle} style={{width:"100%",background:"#534AB7",color:"white",border:"none",borderRadius:14,padding:"14px",cursor:"pointer",fontSize:15,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <i className="ti ti-plus" style={{fontSize:18}} aria-hidden="true"/> הוסף ליד
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Screen ──────────────────────────────────────────────────────────
function CalendarScreen({leads,onOpen}) {
  const today=new Date(),ts=today.toISOString().slice(0,10);
  const upcoming=leads.filter(l=>l.meetingDate&&l.meetingDate>=ts).sort((a,b)=>a.meetingDate.localeCompare(b.meetingDate));
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={g.topbar}><span style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>פגישות קרובות</span></div>
      <div style={g.screen}>
        <div style={{padding:"14px"}}>
          {upcoming.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:"var(--color-text-tertiary)",fontSize:14}}>אין פגישות קרובות</div>}
          {upcoming.map((lead,i)=>{
            const isToday=lead.meetingDate===ts;
            const sc=STATUS_CONFIG[lead.status];
            return(
              <div key={lead.id} style={{background:"var(--color-background-primary)",borderRadius:16,padding:14,marginBottom:10,border:"0.5px solid var(--color-border-tertiary)",borderRight:`4px solid ${isToday?"#D85A30":"#EF9F27"}`}} onClick={()=>onOpen(lead)}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{textAlign:"center",minWidth:44,background:isToday?"#FCEBEB":"#FAEEDA",borderRadius:10,padding:"6px 4px"}}>
                    <div style={{fontSize:10,color:isToday?"#A32D2D":"#854F0B"}}>{isToday?"היום":formatDate(lead.meetingDate)}</div>
                    <div style={{fontSize:16,fontWeight:500,color:isToday?"#D85A30":"#854F0B"}}>{lead.meetingTime}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",marginBottom:2}}>{lead.name}</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{lead.address}</div>
                  </div>
                  <span style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:sc.bg,color:sc.color}}>{sc.label}</span>
                </div>
                <div style={{display:"flex",gap:7}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openWA(lead.phone,`שלום ${lead.name}! מאשר פגישתנו ב-${formatDate(lead.meetingDate)} ${lead.meetingTime}. אשמח לראותך!`)} style={{...g.bigBtn,background:"#EAF3DE",color:"#3B6D11"}}><i className="ti ti-brand-whatsapp" style={{fontSize:15}} aria-hidden="true"/> אשר</button>
                  <button onClick={()=>window.open(`https://www.google.com/maps/search/${encodeURIComponent(lead.address)}`,"_blank")} style={{...g.bigBtn,background:"#FAECE7",color:"#C5221F"}}><i className="ti ti-map-pin" style={{fontSize:15}} aria-hidden="true"/> נווט</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
function DashboardScreen({leads}) {
  const counts=Object.fromEntries(Object.keys(STATUS_CONFIG).map(k=>[k,leads.filter(l=>l.status===k).length]));
  const fire=leads.filter(l=>calcUrgency(l).level==="fire"&&!["signed","lost"].includes(l.status));
  const tv=leads.filter(l=>l.price).reduce((s,l)=>s+Number(l.price.replace(/,/g,"")||0),0);
  const funnel=[{l:"לידים",v:leads.length},{l:"קשר",v:leads.filter(l=>!["new","lost"].includes(l.status)).length},{l:"פגישות",v:leads.filter(l=>["meeting","after_meet","followup","signing","signed"].includes(l.status)).length},{l:"בלעדיות",v:counts.signed}];
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={g.topbar}><span style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>דשבורד</span></div>
      <div style={g.screen}>
        <div style={{padding:"14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{l:"לידים פעילים",v:leads.length},{l:"גויסו",v:counts.signed,color:"#3B6D11"},{l:"דחוף עכשיו",v:fire.length,color:"#D85A30"},{l:"שווי תיק M₪",v:(tv/1e6).toFixed(1)}].map(m=>(
              <div key={m.l} style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,border:"0.5px solid var(--color-border-tertiary)"}}>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:4}}>{m.l}</div>
                <div style={{fontSize:26,fontWeight:500,color:m.color||"var(--color-text-primary)"}}>{m.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,marginBottom:14,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:12}}>משפך גיוס</div>
            {funnel.map(step=>{
              const pct=leads.length>0?Math.round((step.v/leads.length)*100):0;
              return(
                <div key={step.l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)",width:52,textAlign:"right",flexShrink:0}}>{step.l}</span>
                  <div style={{flex:1,background:"var(--color-background-secondary)",borderRadius:6,height:22,overflow:"hidden"}}>
                    <div style={{width:`${pct||4}%`,height:"100%",background:"#534AB7",borderRadius:6,display:"flex",alignItems:"center",paddingRight:8}}>
                      {pct>15&&<span style={{fontSize:11,fontWeight:500,color:"white"}}>{step.v}</span>}
                    </div>
                  </div>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)",width:20}}>{step.v}</span>
                </div>
              );
            })}
          </div>
          <div style={{background:"var(--color-background-primary)",borderRadius:14,padding:14,border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:10}}>פילוח סטטוסים</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {Object.entries(STATUS_CONFIG).filter(([k])=>counts[k]>0).map(([k,v])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,background:v.bg}}>
                  <span style={{fontSize:12,color:v.color,fontWeight:500}}>{v.label}</span>
                  <span style={{fontSize:13,fontWeight:500,color:v.color}}>{counts[k]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({screen,setScreen,urgentCount}) {
  const items=[
    {k:"today",i:"ti-home",l:"היום"},
    {k:"leads",i:"ti-users",l:"לידים"},
    {k:"calendar",i:"ti-calendar",l:"יומן"},
    {k:"dashboard",i:"ti-chart-bar",l:"דשבורד"},
  ];
  return(
    <div style={{background:"var(--color-background-primary)",borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
      {items.map(n=>(
        <button key={n.k} onClick={()=>setScreen(n.k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 0 4px",background:"none",border:"none",cursor:"pointer",position:"relative"}}>
          <i className={`ti ${n.i}`} style={{fontSize:22,color:screen===n.k?"#534AB7":"var(--color-text-secondary)"}} aria-hidden="true"/>
          <span style={{fontSize:10,color:screen===n.k?"#534AB7":"var(--color-text-secondary)",fontWeight:screen===n.k?500:400}}>{n.l}</span>
          {n.k==="today"&&urgentCount>0&&<div style={{position:"absolute",top:6,right:"calc(50% - 14px)",width:8,height:8,background:"#D85A30",borderRadius:"50%"}}/>}
          {n.k==="portfolio"&&leads.filter(l=>l.status==="signed").length>0&&<div style={{position:"absolute",top:4,right:"calc(50% - 16px)",background:"#0F6E56",color:"white",borderRadius:10,padding:"0 5px",fontSize:9,fontWeight:500}}>{leads.filter(l=>l.status==="signed").length}</div>}
        </button>
      ))}
    </div>
  );
}


// ─── Portfolio Screen (גויסו בבלעדיות) ──────────────────────────────────────
function PortfolioScreen({leads,onOpen,showToast}) {
  const [filter,setFilter]=useState("active");
  const portfolio=leads.filter(l=>l.status==="signed"||l.exclusiveEnd);

  const active=portfolio.filter(l=>{
    if(!l.exclusiveEnd) return l.status==="signed";
    return new Date(l.exclusiveEnd)>=new Date();
  });
  const expired=portfolio.filter(l=>l.exclusiveEnd&&new Date(l.exclusiveEnd)<new Date());
  const sold=portfolio.filter(l=>l.soldDate);

  const visible=filter==="active"?active:filter==="expired"?expired:sold;

  const daysLeft=dateStr=>{
    if(!dateStr) return null;
    const diff=Math.floor((new Date(dateStr)-new Date())/86400000);
    return diff;
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={g.topbar}>
        <span style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>תיק נכסים</span>
        <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{active.length} בלעדיות פעילות</div>
      </div>
      <div style={{padding:"10px 14px 0",background:"var(--color-background-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{display:"flex",gap:6,paddingBottom:10}}>
          {[{k:"active",l:`פעילות (${active.length})`},{k:"expired",l:`פגו (${expired.length})`},{k:"sold",l:`נמכרו (${sold.length})`}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,border:`0.5px solid ${filter===f.k?"#AFA9EC":"var(--color-border-tertiary)"}`,background:filter===f.k?"#EEEDFE":"var(--color-background-primary)",color:filter===f.k?"#534AB7":"var(--color-text-secondary)",cursor:"pointer",whiteSpace:"nowrap"}}>
              {f.l}
            </button>
          ))}
        </div>
      </div>
      <div style={g.screen}>
        <div style={{padding:"12px 14px"}}>
          {visible.length===0&&(
            <div style={{textAlign:"center",padding:"60px 20px",color:"var(--color-text-tertiary)"}}>
              <i className="ti ti-building-estate" style={{fontSize:40,display:"block",marginBottom:12}} aria-hidden="true"/>
              <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>
                {filter==="active"?"אין בלעדיות פעילות":filter==="expired"?"אין בלעדיות שפגו":"אין נכסים שנמכרו"}
              </div>
              <div style={{fontSize:12}}>גייס נכס ראשון ושנה סטטוס ל"גויס לבלעדיות"</div>
            </div>
          )}
          {visible.map(lead=>{
            const days=daysLeft(lead.exclusiveEnd);
            const isExpiringSoon=days!==null&&days<=7&&days>=0;
            const isExpired=days!==null&&days<0;
            return(
              <div key={lead.id} style={{background:"var(--color-background-primary)",borderRadius:16,padding:14,marginBottom:10,border:`0.5px solid ${isExpiringSoon?"#EF9F27":isExpired?"#B4B2A9":"var(--color-border-tertiary)"}`,borderRight:`4px solid ${isExpiringSoon?"#EF9F27":isExpired?"#B4B2A9":"#0F6E56"}`}} onClick={()=>onOpen(lead)}>

                {/* Expiry warning */}
                {isExpiringSoon&&<div style={{fontSize:11,background:"#FAEEDA",color:"#854F0B",borderRadius:8,padding:"4px 9px",marginBottom:8,fontWeight:500}}>⚠️ בלעדיות פגה בעוד {days} ימים — לחדש?</div>}
                {isExpired&&<div style={{fontSize:11,background:"#F1EFE8",color:"#5F5E5A",borderRadius:8,padding:"4px 9px",marginBottom:8}}>בלעדיות פגה</div>}
                {lead.soldDate&&<div style={{fontSize:11,background:"#E1F5EE",color:"#0F6E56",borderRadius:8,padding:"4px 9px",marginBottom:8,fontWeight:500}}>✓ נמכר ב-{formatDate(lead.soldDate)}</div>}

                {/* Property header */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:42,height:42,borderRadius:10,background:"#E1F5EE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <i className="ti ti-building" style={{fontSize:20,color:"#0F6E56"}} aria-hidden="true"/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",marginBottom:1}}>{lead.name}</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.address}</div>
                  </div>
                  {lead.price&&<div style={{fontSize:13,fontWeight:500,color:"#0F6E56",flexShrink:0}}>₪{lead.price}</div>}
                </div>

                {/* Details row */}
                <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                  {lead.rooms&&<span style={{fontSize:11,color:"var(--color-text-secondary)",display:"flex",alignItems:"center",gap:4}}><i className="ti ti-door" style={{fontSize:13}} aria-hidden="true"/>{lead.rooms} חד'</span>}
                  {lead.exclusiveStart&&<span style={{fontSize:11,color:"var(--color-text-secondary)",display:"flex",alignItems:"center",gap:4}}><i className="ti ti-calendar" style={{fontSize:13}} aria-hidden="true"/>מ-{formatDate(lead.exclusiveStart)}</span>}
                  {lead.exclusiveEnd&&<span style={{fontSize:11,color:isExpiringSoon?"#854F0B":"var(--color-text-secondary)",display:"flex",alignItems:"center",gap:4,fontWeight:isExpiringSoon?500:400}}><i className="ti ti-calendar-off" style={{fontSize:13}} aria-hidden="true"/>עד {formatDate(lead.exclusiveEnd)}</span>}
                </div>

                {/* Actions */}
                <div style={{display:"flex",gap:7,paddingTop:8,borderTop:"0.5px solid var(--color-border-tertiary)"}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openWA(lead.phone,`שלום ${lead.name}, עדכון לגבי הנכס שלך — `)} style={{...g.bigBtn,background:"#EAF3DE",color:"#3B6D11"}}><i className="ti ti-brand-whatsapp" style={{fontSize:15}} aria-hidden="true"/> עדכן מוכר</button>
                  {!lead.soldDate&&(
                    <button onClick={e=>{e.stopPropagation();const updated={...lead,soldDate:new Date().toISOString().slice(0,10),timeline:[{date:new Date().toISOString().slice(0,10),type:"signed",text:"נכס נמכר!"},...lead.timeline]};onOpen(updated);showToast("מזל טוב! 🎉");}} style={{...g.bigBtn,background:"#E1F5EE",color:"#0F6E56"}}>
                      <i className="ti ti-check" style={{fontSize:15}} aria-hidden="true"/> נמכר!
                    </button>
                  )}
                  {isExpiringSoon&&(
                    <button onClick={e=>{e.stopPropagation();showToast("פותח חידוש בלעדיות...");}} style={{...g.iconBtn,background:"#FAEEDA",color:"#854F0B"}}>
                      <i className="ti ti-refresh" style={{fontSize:16}} aria-hidden="true"/>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [screen,setScreen]=useState("today");
  const [detail,setDetail]=useState(null);
  const [summaryLead,setSummaryLead]=useState(null);
  const [portfolioOpen,setPortfolioOpen]=useState(false);
  const [adding,setAdding]=useState(false);
  const [prefill,setPrefill]=useState(null);
  const [toast,setToast]=useState("");

  // Load from Supabase on mount
  useEffect(()=>{
    sb.getLeads()
      .then(data=>{setLeads(data);setLoading(false);})
      .catch(()=>{setLeads(SAMPLE_LEADS);setLoading(false);});
  },[]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2200);};

  // Update lead — local + Supabase
  const updateLead=u=>{
    setLeads(ls=>ls.map(l=>l.id===u.id?u:l));
    sb.updateLead(u);
    // Save new timeline entries
    if(u.timeline?.length>0){
      const latest=u.timeline[0];
      sb.addTimelineEntry(u.id,latest.type,latest.text);
    }
    if(detail?.id===u.id) setDetail(u);
  };

  const saveSummary=(lead,formData,aiMsg)=>{
    const entry={date:new Date().toISOString().slice(0,10),type:"after_meet",text:`סיכום פגישה נשמר${aiMsg?" · ווצאפ נשלח":""}`};
    updateLead({...lead,meetingSummary:formData,status:"after_meet",followUpDate:addMonths(new Date().toISOString().slice(0,10),0),followUpNote:"פולואפ לאחר פגישה",timeline:[entry,...lead.timeline]});
  };

  const deleteLead=id=>{
    sb.deleteLead(id);
    setLeads(ls=>ls.filter(l=>l.id!==id));
    setDetail(null);
    showToast("ליד נמחק");
  };

  const addLead=async l=>{
    // Add locally immediately so the UI never feels stuck
    setLeads(ls=>[l,...ls]);
    setAdding(false);
    setPrefill(null);
    showToast("ליד נוסף ✓");
    try{
      const saved=await sb.addLead(l);
      if(saved?.id){
        // Replace temp id with real Supabase id
        setLeads(ls=>ls.map(x=>x.id===l.id?{...x,id:saved.id}:x));
      }
    }catch(e){
      console.error(e);
      showToast("נשמר במכשיר — בעיה בסנכרון לשרת");
    }
  };

  const handleWA=lead=>{
    const msg=`שלום ${lead.name}, אני [שמך] מתווך נדל"ן. ${lead.status==="after_meet"?"רציתי לעקוב אחרי הפגישה שלנו ולשמוע מה חשבת.":"אשמח לדבר איתך על הנכס שלך. מתי נוח לך?"}`;
    openWA(lead.phone,msg);
  };

  const handleAddContact=()=>{
    // Use Web Contact Picker API if available
    if(navigator.contacts){
      navigator.contacts.select(["name","tel"],{multiple:false}).then(contacts=>{
        if(contacts&&contacts.length>0){
          const c=contacts[0];
          setPrefill({name:c.name?.[0]||"",phone:c.tel?.[0]||"",address:"",rooms:"",price:"",source:"ישיר",notes:"",reminder:"",followUpDate:"",followUpNote:""});
          setAdding(true);
        }
      }).catch(()=>{setAdding(true);});
    } else {
      showToast("פותח טופס ליד חדש...");
      setAdding(true);
    }
  };

  const urgentCount=leads.filter(l=>calcUrgency(l).level==="fire"&&!["signed","lost"].includes(l.status)).length;

  // Detail or Add screens take full screen
  if(loading) return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",alignItems:"center",justifyContent:"center",direction:"rtl",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)",gap:16}}>
      <div style={{width:52,height:52,background:"#534AB7",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <i className="ti ti-building-estate" style={{fontSize:28,color:"white"}} aria-hidden="true"/>
      </div>
      <div style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>פולואפ</div>
      <div style={{fontSize:13,color:"var(--color-text-secondary)"}}>טוען נתונים...</div>
    </div>
  );
  if(summaryLead) return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",direction:"rtl",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>
      <MeetingSummaryScreen lead={summaryLead} onBack={()=>setSummaryLead(null)} onSave={(form,msg)=>saveSummary(summaryLead,form,msg)} showToast={showToast}/>
      <Toast msg={toast}/>
    </div>
  );
  if(adding) return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",direction:"rtl",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>
      <AddLeadScreen onBack={()=>{setAdding(false);setPrefill(null);}} onAdd={addLead} prefill={prefill} existingLeads={leads} onOpenExisting={l=>{setAdding(false);setPrefill(null);setDetail(l);}}/>
    </div>
  );
  if(detail) return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",direction:"rtl",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>
      <LeadDetailScreen lead={detail} onBack={()=>setDetail(null)} onUpdate={l=>{updateLead(l);setDetail(l);}} onDelete={deleteLead} onWA={handleWA} onCall={openCall} onSummary={l=>{setSummaryLead(l);}} showToast={showToast}/>
      <Toast msg={toast}/>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",direction:"rtl",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>
      {screen==="today"&&<TodayScreen leads={leads} onOpen={setDetail} onWA={handleWA} onCall={openCall} onSummary={l=>setSummaryLead(l)}/>}
      {screen==="leads"&&<LeadsScreen leads={leads} onOpen={setDetail} onWA={handleWA} onCall={openCall} onAddContact={handleAddContact} onSummary={l=>setSummaryLead(l)}/>}
      {screen==="calendar"&&<CalendarScreen leads={leads} onOpen={setDetail}/>}
      {screen==="portfolio"&&<PortfolioScreen leads={leads} onOpen={setDetail} showToast={showToast}/>}
      {screen==="dashboard"&&<DashboardScreen leads={leads}/>}
      <BottomNav screen={screen} setScreen={setScreen} urgentCount={urgentCount}/>
      {!adding&&!detail&&(
        <button onClick={()=>setAdding(true)} style={{position:"fixed",bottom:74,left:16,width:52,height:52,background:"#534AB7",borderRadius:"50%",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 2px 12px rgba(83,74,183,0.4)"}} aria-label="הוסף ליד חדש">
          <i className="ti ti-plus" style={{fontSize:24,color:"white"}} aria-hidden="true"/>
        </button>
      )}
      <Toast msg={toast}/>
    </div>
  );
}

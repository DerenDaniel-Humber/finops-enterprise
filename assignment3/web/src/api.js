const base=import.meta.env.VITE_API_URL||'/api/v1';
export async function api(path,options={}){const headers={'Content-Type':'application/json',...(options.headers||{})};const actorId=localStorage.getItem('actorId');if(actorId)headers['X-Actor-Id']=actorId;const response=await fetch(`${base}${path}`,{...options,headers});const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.error?.message||'Request failed');error.code=data.error?.code;error.status=response.status;throw error;}return data;}
export const money=(minor,currency='CAD')=>new Intl.NumberFormat('en-CA',{style:'currency',currency,maximumFractionDigits:2}).format((minor||0)/100);
export const date=(value)=>value?new Date(value).toLocaleString():'—';

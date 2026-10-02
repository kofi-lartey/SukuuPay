const store = new Map();
globalThis.localStorage = { getItem: (k)=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:(k)=>store.delete(k), clear:()=>store.clear(), get length(){return store.size;} };
globalThis.window = { addEventListener:()=>{}, removeEventListener:()=>{}, location:{pathname:"/admin"}, matchMedia:()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}) };
globalThis.document = { addEventListener:()=>{}, removeEventListener:()=>{}, createElement:()=>({style:{},setAttribute:()=>{},appendChild:()=>{},click:()=>{}}), body:{appendChild:()=>{},removeChild:()=>{}}, querySelector:()=>null };
await import("./out-cards/overview-cards.js");

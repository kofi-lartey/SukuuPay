const store = new Map();
globalThis.localStorage = { getItem:(k)=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:(k)=>store.delete(k), clear:()=>store.clear(), get length(){return store.size;} };
globalThis.window = { addEventListener:()=>{}, removeEventListener:()=>{}, location:{pathname:"/",origin:"http://localhost",search:""}, matchMedia:()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}) };
globalThis.document = { addEventListener:()=>{}, removeEventListener:()=>{}, createElement:()=>({style:{},setAttribute:()=>{},appendChild:()=>{},click:()=>{}}), body:{appendChild:()=>{},removeChild:()=>{}}, querySelector:()=>null, documentElement:{style:{}}, head:{appendChild:()=>{}}, getElementById:()=>null };
globalThis.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
await import("./tmp-out-home/tmp-home-check.js");

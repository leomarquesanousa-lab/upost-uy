'use client';
import {useEffect,useState} from 'react';
import {GoogleAnalytics,GoogleAdSense} from './google-scripts';
export function ConsentedScripts({measurementId,clientId}:{measurementId:string;clientId:string}){
 const [consent,setConsent]=useState({analytics:false,advertising:false});
 useEffect(()=>{
  const read=()=>{try{const raw=document.cookie.split('; ').find(c=>c.startsWith('upost_cookie_consent='))?.split('=').slice(1).join('=');const value=raw?JSON.parse(decodeURIComponent(raw)):{};setConsent({analytics:value.analytics===true,advertising:value.advertising===true});}catch{setConsent({analytics:false,advertising:false});}};
  read();window.addEventListener('upost:cookie-consent-changed',read);return ()=>window.removeEventListener('upost:cookie-consent-changed',read);
 },[]);
 return <>{consent.analytics&&measurementId&&<GoogleAnalytics measurementId={measurementId}/>} {consent.advertising&&clientId&&<GoogleAdSense clientId={clientId}/>}</>;
}

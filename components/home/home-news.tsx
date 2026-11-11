'use client';
import {useState,useTransition,type ReactNode} from 'react';
import type {NewsCardData} from '@/lib/editorial/types';
import {loadHomeNews} from '@/app/home-news-action';
import {EditorialEdition} from './editorial-edition';

export function HomeNews({items:initial,page:initialPage,pages:initialPages,excludedIds,interlude}:{items:NewsCardData[];page:number;pages:number;excludedIds:string[];interlude?:ReactNode}){
 const [items,setItems]=useState(initial),[page,setPage]=useState(initialPage),[pages,setPages]=useState(initialPages),[error,setError]=useState(''),[pending,start]=useTransition();
 function load(){
  setError('');start(async()=>{try{
   const next=await loadHomeNews(page+1);
   setItems(current=>{const seen=new Set([...excludedIds,...current.map(n=>n.id)]);return [...current,...next.items.filter(n=>{if(seen.has(n.id))return false;seen.add(n.id);return true;})];});
   setPage(next.page);setPages(next.page<page+1?next.page:next.pages);
  }catch{setError('No se pudieron cargar más noticias. Intentá nuevamente.');}});
 }
 return <><EditorialEdition items={items} interlude={interlude}/>
  {page<pages&&<div className="form-actions"><button className="button secondary" type="button" disabled={pending} onClick={load}>{pending?'Cargando…':'Cargar más noticias'}</button></div>}
  {error&&<p role="alert">{error}</p>}
 </>;
}

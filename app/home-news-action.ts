'use server';
import {homeNews} from '@/server/repositories/editorial';
import {toNewsCardData} from '@/lib/editorial/types';

export async function loadHomeNews(page:number){
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw Error('Página inválida.');
 const result=await homeNews(String(page));
 return {items:result.recent.map(toNewsCardData),page:result.page,pages:result.pages};
}

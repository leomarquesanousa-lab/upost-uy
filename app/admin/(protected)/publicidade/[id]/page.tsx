import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOperations } from '@/lib/auth/operations';
import { advertisingData } from '@/server/services/ads';
import { AdForm } from '@/components/admin/ad-form';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireOperations();const {id}=await params,d=await advertisingData(),record=id==='nova'?undefined:d.campaigns.find(c=>c.id===id);if(id!=='nova'&&!record)notFound();return <><Link href="/admin/publicidade">← Publicidade</Link><h1>{record?'Editar campanha':'Nova campanha'}</h1><AdForm record={record} slots={d.slots} timezone={d.timezone}/></>;}

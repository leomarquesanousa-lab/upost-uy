import 'server-only';
import { getPool } from '@/lib/db/pool';
import { withAdditionalRadios } from '@/lib/radio-stations.mjs';
export type ResourceKind = 'partner' | 'radio' | 'source';
export type PortalResource = {
 id:string; kind:ResourceKind; name:string; url:string; description:string; image_url:string;
 media_type:string; stream_url:string; feed_url:string; category_slug:string;
 active:boolean; display_order:number;
};
export type RadioStation = { id:string; name:string; location:string; website:string; streamUrl:string; imageUrl:string };
export function radioStation(item:PortalResource):RadioStation|null {
 if(item.kind!=='radio'||!item.active||!item.stream_url)return null;
 try{const url=new URL(item.stream_url);if(url.protocol!=='https:'||url.username||url.password)return null;}catch{return null;}
 return {id:item.id,name:item.name,location:item.description,website:item.url,streamUrl:item.stream_url,imageUrl:item.image_url};
}
export async function portalResources(kind: ResourceKind, admin=false): Promise<{items:PortalResource[];ready:boolean}> {
 try {
  const result=await getPool().query<PortalResource>('SELECT * FROM portal_resources WHERE kind=$1 '+(admin||kind==='radio'?'':'AND active ')+'ORDER BY display_order,name,id',[kind]);
  const items:PortalResource[]=kind==='radio'?withAdditionalRadios(result.rows):result.rows;
  return {items:admin?items:items.filter(item=>item.active),ready:true};
 } catch(error) {
  if ((error as {code?:string}).code==='42P01') return {items:[],ready:false};
  throw error;
 }
}

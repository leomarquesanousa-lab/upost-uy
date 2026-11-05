import {requireOperations} from '@/lib/auth/operations';
import {AutomaticSources} from '@/components/admin/automatic-sources';
export const maxDuration=300;
export const metadata={title:'Fuentes automáticas | UPOST.uy'};
export default async function AutomaticSourcesPage(){
 await requireOperations();
 return <><p className="eyebrow">UPOST.uy · REDACCIÓN</p><h1>Fuentes automáticas</h1><AutomaticSources/></>;
}

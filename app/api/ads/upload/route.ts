import { getUser } from '@/lib/auth/session';
import { POST as upload } from '@/app/api/editorial/upload/route';
export async function POST(request:Request){const user=await getUser();if(!user||user.role==='EDITOR')return Response.json({error:'Acesso não autorizado.'},{status:403});return upload(request);}

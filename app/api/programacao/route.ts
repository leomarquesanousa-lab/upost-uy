import { NextResponse } from 'next/server';
import { currentProgramming } from '@/server/services/programming';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(await currentProgramming(),{headers:{'Cache-Control':'no-store'}});}

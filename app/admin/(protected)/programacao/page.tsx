import { requireEditorial } from '@/lib/auth/editorial';
import { programmingData } from '@/server/services/programming';
import { ScheduleAdmin } from '@/components/programming/admin';
export default async function Page(){await requireEditorial();const d=await programmingData();return <><h1>Programação</h1><p>Fuso do portal: {d.timezone}</p><ScheduleAdmin slots={d.slots} exceptions={d.exceptions} programs={d.programs}/></>;}
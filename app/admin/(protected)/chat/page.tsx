import { requireEditorial } from '@/lib/auth/editorial';
import { Chat } from '@/components/programming/chat';
export default async function Page(){await requireEditorial();return <><h1>Chat e moderação</h1><p>Respostas da equipe são públicas. O bloqueio vale para a sessão do visitante.</p><Chat admin/></>;}
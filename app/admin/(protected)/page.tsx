import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { getPool } from '@/lib/db/pool';
export default async function Dashboard(){const user=await requireUser();const operational=user.role!=='EDITOR';
 const r=(await getPool().query(`SELECT
 (SELECT count(*) FROM public_news) AS published,
 (SELECT count(*) FROM news WHERE status='DRAFT') AS drafts,
 (SELECT count(*) FROM programs WHERE active) AS programs,
 (SELECT count(*) FROM presenters WHERE active) AS presenters,
 (SELECT count(*) FROM song_requests WHERE status='NEW') AS requests,
 (SELECT count(*) FROM chat_messages WHERE created_at>now()-interval '24 hours' AND status='VISIBLE') AS chat
 ${operational?",(SELECT count(*) FROM ad_campaigns c JOIN ad_slots s ON s.id=c.slot_id WHERE c.active AND s.active AND c.start_at<=now() AND (c.end_at IS NULL OR c.end_at>now())) AS campaigns,(SELECT count(*) FROM users WHERE active AND deleted_at IS NULL) AS users":''}`)).rows[0];
 const cards=[['Notícias publicadas',r.published,'/admin/noticias'],['Rascunhos',r.drafts,'/admin/noticias'],['Programas ativos',r.programs,'/admin/programas'],['Apresentadores ativos',r.presenters,'/admin/apresentadores'],['Pedidos musicais novos',r.requests,'/admin/pedidos-musicais'],['Mensagens visíveis · últimas 24h',r.chat,'/admin/chat'],...(operational?[['Campanhas em veiculação',r.campaigns,'/admin/publicidade'],['Usuários ativos',r.users,'/admin/usuarios']]:[])];
 return <><p className="eyebrow">PAINEL / DASHBOARD</p><h1>Olá, {user.name}.</h1><p>Acompanhe a operação do portal.</p><div className="dashboard-grid">{cards.map(([label,count,href])=><section className="card" key={label}><h2>{label}</h2><strong className="dashboard-count">{count}</strong><p><Link href={href}>Gerenciar →</Link></p></section>)}</div></>;
}

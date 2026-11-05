import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/db/pool';
import { text, uuid, mediaPath, EditorialError } from '@/lib/editorial/validation';
import { topAdSlots } from './ads';

export async function saveSimpleBanner(form: FormData, userId: string) {
  const image = mediaPath(text(form, 'image_url', 200, true));
  const id = form.get('id') ? uuid(String(form.get('id'))) : randomUUID();
  const code = text(form, 'position', 60) || 'HOME_TOP';
  const position = topAdSlots.find(slot => slot.code === code);
  if (!position) throw new EditorialError('Posición inválida.');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const asset = await client.query('SELECT path FROM media_assets WHERE path=$1', [image]);
    if (!asset.rowCount) throw new EditorialError('Seleccioná una imagen subida al portal.');
    if (form.get('id')) {
      const result = await client.query('UPDATE ad_campaigns c SET image_url=$1,updated_at=now() FROM ad_slots s WHERE c.id=$2 AND c.slot_id=s.id AND s.code=ANY($3::text[])', [image, id, topAdSlots.map(slot => slot.code)]);
      if (!result.rowCount) throw new EditorialError('Banner no encontrado.');
    } else {
      await client.query('INSERT INTO ad_slots(id,code,name,description,active) VALUES($1,$2,$3,$4,true) ON CONFLICT(code) DO NOTHING', [randomUUID(), code, position.name, position.description]);
      await client.query('UPDATE ad_slots SET active=true,updated_at=now() WHERE code=$1', [code]);
      await client.query(`INSERT INTO ad_campaigns(id,name,advertiser_name,slot_id,image_url,alt_text,destination_url,start_at,end_at,active,priority)
        SELECT $1,'Banner UPOST.uy','UPOST.uy',id,$2,'Banner de UPOST.uy','',now(),NULL,true,0 FROM ad_slots WHERE code=$3`, [id, image, code]);
    }
    await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,$2,'ad_campaigns',$3)", [userId, form.get('id') ? 'ads.image_replaced' : 'ads.banner_created', id]);
    await client.query('COMMIT');
    return id;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function manageSimpleBanner(form: FormData, userId: string) {
  const id = uuid(text(form, 'id', 36, true));
  const action = text(form, 'operation', 16, true);
  if (!['delete', 'toggle', 'up', 'down'].includes(action)) throw new EditorialError('Acción inválida.');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Serialize order changes with other banner-management requests.
    await client.query('SELECT pg_advisory_xact_lock(84201907)');
    const result = await client.query('SELECT c.id,c.slot_id FROM ad_campaigns c JOIN ad_slots s ON s.id=c.slot_id WHERE c.id=$1 AND s.code=ANY($2::text[]) FOR UPDATE OF c', [id, topAdSlots.map(slot => slot.code)]);
    if (!result.rowCount) throw new EditorialError('Banner no encontrado.');
    if (action === 'delete') await client.query('DELETE FROM ad_campaigns WHERE id=$1', [id]);
    else if (action === 'toggle') await client.query('UPDATE ad_campaigns SET active=NOT active,updated_at=now() WHERE id=$1', [id]);
    else {
      const ordered = await client.query('SELECT id FROM ad_campaigns WHERE slot_id=$1 ORDER BY priority DESC,created_at,id FOR UPDATE', [result.rows[0].slot_id]);
      const ids: string[] = ordered.rows.map(row => row.id);
      const index = ids.indexOf(id), target = index + (action === 'up' ? -1 : 1);
      if (target >= 0 && target < ids.length) {
        [ids[index], ids[target]] = [ids[target], ids[index]];
        if (ids.length > 1001) throw new EditorialError('No se pudo ordenar esta cantidad de banners.');
        await client.query('UPDATE ad_campaigns c SET priority=1001-v.ord::integer,updated_at=now() FROM unnest($1::uuid[]) WITH ORDINALITY AS v(id,ord) WHERE c.id=v.id', [ids]);
      }
    }
    await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,$2,'ad_campaigns',$3)", [userId, 'ads.banner_' + action, id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

ALTER TABLE users ADD COLUMN deleted_at timestamptz;
ALTER TABLE users ADD CONSTRAINT deleted_user_inactive CHECK(deleted_at IS NULL OR NOT active);
CREATE INDEX users_management_idx ON users(role,active,name) WHERE deleted_at IS NULL;

CREATE TABLE ad_slots (
 id uuid PRIMARY KEY, code varchar(60) UNIQUE NOT NULL, name varchar(120) NOT NULL,
 description varchar(600) NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ad_slots(id,code,name,description) VALUES
 ('00500000-0000-4000-8000-000000000001','HOME_BETWEEN_SECTIONS','Home — entre seções','Após as notícias principais, antes da câmera e chat.'),
 ('00500000-0000-4000-8000-000000000002','HOME_BOTTOM','Home — abaixo das seções','Após o pedido musical.'),
 ('00500000-0000-4000-8000-000000000003','NEWS_TOP','Notícia — acima da matéria','Antes do início da matéria.'),
 ('00500000-0000-4000-8000-000000000004','NEWS_BOTTOM','Notícia — abaixo da matéria','Depois da matéria, antes das relacionadas.'),
 ('00500000-0000-4000-8000-000000000005','FOOTER','Rodapé público','Antes do rodapé, fora do player persistente.');
CREATE TABLE ad_campaigns (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, advertiser_name varchar(160) NOT NULL,
 slot_id uuid NOT NULL REFERENCES ad_slots(id), image_url text NOT NULL, mobile_image_url text NOT NULL DEFAULT '',
 alt_text varchar(300) NOT NULL, destination_url text NOT NULL,
 start_at timestamptz NOT NULL, end_at timestamptz, active boolean NOT NULL DEFAULT true,
 priority integer NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 1000),
 impressions bigint NOT NULL DEFAULT 0 CHECK(impressions>=0), clicks bigint NOT NULL DEFAULT 0 CHECK(clicks>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_at IS NULL OR end_at>start_at)
);
CREATE INDEX ad_campaigns_delivery_idx ON ad_campaigns(slot_id,priority DESC,start_at,end_at) WHERE active;
-- One short-lived receipt per rendered banner; no IP, account or browser fingerprint.
CREATE TABLE ad_deliveries (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 impression_at timestamptz, click_at timestamptz
);
CREATE INDEX ad_deliveries_expiry_idx ON ad_deliveries(expires_at);
CREATE INDEX ad_deliveries_campaign_idx ON ad_deliveries(campaign_id);

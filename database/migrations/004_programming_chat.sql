CREATE TABLE presenters (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, slug varchar(180) UNIQUE NOT NULL,
 bio text NOT NULL DEFAULT '', photo_url text NOT NULL DEFAULT '',
 social_instagram text NOT NULL DEFAULT '', social_facebook text NOT NULL DEFAULT '', social_x text NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE programs (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, slug varchar(180) UNIQUE NOT NULL,
 short_description varchar(400) NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', cover_image text NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE program_presenters (
 program_id uuid REFERENCES programs(id) ON DELETE CASCADE, presenter_id uuid REFERENCES presenters(id) ON DELETE CASCADE,
 PRIMARY KEY(program_id,presenter_id)
);
CREATE INDEX program_presenters_presenter_idx ON program_presenters(presenter_id);
CREATE TABLE schedule_slots (
 id uuid PRIMARY KEY, weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6), program_id uuid NOT NULL REFERENCES programs(id),
 start_time time NOT NULL, end_time time NOT NULL, active boolean NOT NULL DEFAULT true,
 CHECK(start_time < end_time), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schedule_slots_day_idx ON schedule_slots(weekday,start_time) WHERE active;
CREATE TABLE schedule_exceptions (
 id uuid PRIMARY KEY, date date NOT NULL, program_id uuid REFERENCES programs(id), start_time time NOT NULL, end_time time NOT NULL,
 title varchar(120) NOT NULL DEFAULT '', note varchar(600) NOT NULL DEFAULT '', cancelled boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true, CHECK(start_time < end_time), CHECK(cancelled OR program_id IS NOT NULL),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schedule_exceptions_date_idx ON schedule_exceptions(date,start_time) WHERE active;
-- Serialized by the service's transaction advisory lock; also protects direct SQL writes.
CREATE FUNCTION programming_overlap_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(84201904);
 IF NEW.active THEN
  IF TG_TABLE_NAME='schedule_slots' THEN
   IF EXISTS(SELECT 1 FROM schedule_slots WHERE active AND weekday=NEW.weekday AND id<>NEW.id AND start_time<NEW.end_time AND end_time>NEW.start_time) THEN
    RAISE EXCEPTION 'Conflito de horários ativos' USING ERRCODE='23P01';
   END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM schedule_exceptions WHERE active AND date=NEW.date AND id<>NEW.id AND start_time<NEW.end_time AND end_time>NEW.start_time) THEN
    RAISE EXCEPTION 'Conflito de horários especiais' USING ERRCODE='23P01';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER slots_overlap BEFORE INSERT OR UPDATE ON schedule_slots FOR EACH ROW EXECUTE FUNCTION programming_overlap_guard();
CREATE TRIGGER exceptions_overlap BEFORE INSERT OR UPDATE ON schedule_exceptions FOR EACH ROW EXECUTE FUNCTION programming_overlap_guard();
CREATE TABLE chat_visitors (
 id uuid PRIMARY KEY, token_hash char(64) UNIQUE NOT NULL, display_name varchar(40) NOT NULL,
 blocked boolean NOT NULL DEFAULT false, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_visitors_expiry_idx ON chat_visitors(expires_at);
CREATE TABLE chat_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, visitor_id uuid REFERENCES chat_visitors(id), user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 display_name varchar(120) NOT NULL, message varchar(500) NOT NULL CHECK(length(trim(message))>0),
 sender_type text NOT NULL CHECK(sender_type IN ('VISITOR','STAFF')),
 status text NOT NULL DEFAULT 'VISIBLE' CHECK(status IN ('VISIBLE','HIDDEN','DELETED')),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(sender_type<>'VISITOR' OR visitor_id IS NOT NULL)
);
CREATE INDEX chat_messages_visible_idx ON chat_messages(id DESC) WHERE status='VISIBLE';
CREATE INDEX chat_messages_visitor_idx ON chat_messages(visitor_id,id DESC);
INSERT INTO settings(key,value) VALUES ('PORTAL_TIMEZONE','America/Sao_Paulo'),('CHAT_ENABLED','true') ON CONFLICT DO NOTHING;

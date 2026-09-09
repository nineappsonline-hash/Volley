const {PGlite}=require('@electric-sql/pglite');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
async function main(){
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION is_account_blocked() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.blocked',true),'false')='true' $$;
CREATE FUNCTION is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.super',true),'false')='true' $$;
CREATE TABLE academies(id uuid PRIMARY KEY);CREATE TABLE profiles(id uuid,role text,is_active boolean,academy_id uuid);
INSERT INTO academies VALUES('10000000-0000-0000-0000-000000000000'),('20000000-0000-0000-0000-000000000000');
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','admin',true,'10000000-0000-0000-0000-000000000000');
SET test.uid='00000000-0000-0000-0000-000000000001';`);
const sql=readFileSync(join(__dirname,'../supabase/migrations/20260909030000_academy_training_prices.sql'),'utf8');await db.exec(sql);await db.exec(sql);
const save=(count=8,price=800,trial=100,id='10000000-0000-0000-0000-000000000000')=>db.query('SELECT set_academy_training_prices($1,$2,$3,$4)',[id,count,price,trial]);
await save();let r=(await db.query('SELECT * FROM academies WHERE monthly_sessions IS NOT NULL')).rows[0];assert.equal(r.monthly_sessions,8);assert.equal(Number(r.monthly_price),800);assert.equal(Number(r.tryout_price),100);
await save(4,400,0);await save(null,null,null);await assert.rejects(save(null,100));await assert.rejects(save(0));await assert.rejects(save(101));await assert.rejects(save(8,-1));await assert.rejects(save(8,100,-1));await assert.rejects(save(8,'NaN'));await assert.rejects(save(8,800,100,'20000000-0000-0000-0000-000000000000'));
await db.exec("UPDATE profiles SET role='member'");await assert.rejects(save());await assert.rejects(db.exec('UPDATE academies SET monthly_price=10'));
await db.exec("SET test.super='true'");await save(10,1000,150,'20000000-0000-0000-0000-000000000000');
await db.exec("SET test.blocked='true'");await assert.rejects(save());await db.exec("SET test.blocked='false'; SET test.uid=''");await assert.rejects(save());
console.log('PASS: rerun, save/edit/clear, free tryout, validation, owner isolation, member/direct-write denial, super admin, blocked/anonymous');await db.close();}
main().catch(e=>{console.error(e);process.exitCode=1});

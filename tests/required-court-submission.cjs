const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
(async()=>{const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE SCHEMA playza_private;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
 CREATE TABLE academies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,slug text,country text,governorate text,area text,is_public boolean,is_trial boolean,trial_ends_at timestamptz,plan text,invite_code text);
 CREATE TABLE profiles(id uuid PRIMARY KEY,email text,role text,name text,username text,phone text,country text,gender text,birth_date date,join_date date,academy_id uuid,is_active boolean);
 CREATE TABLE sports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid,name text,UNIQUE(academy_id,name));
 CREATE TABLE membership_plans(academy_id uuid,name text,sessions_count integer);
 CREATE TABLE playground_owners(profile_id uuid UNIQUE,business_name text,phone text,country text,governorate text,area text,status text);
 CREATE TABLE venues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid,owner_profile_id uuid,name text,address text,capacity integer,sport_id uuid,school_name text,rental_cost numeric,rental_hours numeric DEFAULT 1,court_count integer DEFAULT 1,location_link text,photos jsonb DEFAULT '[]',cover_url text,contact_phone text,country text,governorate text,area text,court_availability jsonb DEFAULT '[]',working_hours jsonb DEFAULT '[]');
 INSERT INTO venues(name) VALUES('Legacy court');INSERT INTO sports(name) VALUES('Volleyball');`);
 const migration=fs.readFileSync('supabase/migrations/20270108000004_required_court_submission.sql','utf8');await db.exec(migration);await db.exec(migration);
 await db.exec('CREATE TRIGGER seed_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()');
 const sport=(await db.query('SELECT id FROM sports LIMIT 1')).rows[0].id;
 const valid={name:'New court',address:'Street address',sport_id:sport,rental_cost:100,rental_hours:1,court_count:1,location_link:'https://maps.google.com/',photos:['https://example.com/court.jpg'],contact_phone:'01012345678',country:'Egypt',governorate:'Cairo',area:'New Cairo',court_availability:[{court_number:1,weekday:1,start:'09:00',end:'20:00'}],working_hours:[{weekday:1,start:'09:00',end:'20:00'}]};
 async function insert(v){return db.query('INSERT INTO venues SELECT r.* FROM jsonb_populate_record(NULL::venues,$1::jsonb) r RETURNING *',[JSON.stringify({id:crypto.randomUUID(),...v})]);}
 const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/lib/court-submission.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(require,out);
 assert.deepEqual(out.missingCourtSubmissionFields(valid),[]);
 for(const [field,replacement] of [['name',''],['address',''],['sport_id',null],['contact_phone','bad'],['country',''],['governorate',''],['area',''],['location_link','javascript:bad'],['rental_cost',null],['rental_hours',0],['court_count',0],['photos',[]],['court_availability',[]]]){
  const bad={...valid,[field]:replacement};assert.ok(out.missingCourtSubmissionFields(bad).length,field);await assert.rejects(insert(bad),/Required court information|Valid court working hours/,field);
 }
 await assert.rejects(insert({...valid,court_availability:[{court_number:null,weekday:null,start:null,end:null}]}),/Valid court working hours/);
 await assert.rejects(insert({...valid,court_availability:[{court_number:1,weekday:1,start:'20:00',end:'09:00'}]}),/Valid court working hours/);
 await insert(valid);
 await db.exec("UPDATE venues SET address='Legacy edit still permitted' WHERE name='Legacy court'");
 const signupCourt={...valid,sport:'Volleyball',governorate:'Alexandria',area:'Agamy'};delete signupCourt.sport_id;
 for(const owner of [true,false]){
  const id=crypto.randomUUID();const meta={name:'Applicant',phone:'01099999999',country:'Egypt',new_academy_country:'Egypt',new_academy_governorate:'Cairo',new_academy_area:'New Cairo',sports:'Volleyball',...(owner?{owner_mode:true,business_name:'Owner',new_owner_venues:[signupCourt]}:{new_academy_name:'Academy',new_academy_venues:[signupCourt]})};
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,'test@example.invalid',JSON.stringify(meta)]);
  const rows=(await db.query('SELECT * FROM venues WHERE owner_profile_id=$1 OR academy_id=(SELECT academy_id FROM profiles WHERE id=$1)',[id])).rows;
  assert.equal(rows.length,1);const v=rows[0];assert.equal(v.contact_phone,valid.contact_phone);assert.equal(v.governorate,'Alexandria');assert.equal(v.area,'Agamy');assert.deepEqual(v.photos,valid.photos);assert.deepEqual(v.court_availability,valid.court_availability);
 }
 const badId=crypto.randomUUID();await assert.rejects(db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[badId,'bad@example.invalid',JSON.stringify({name:'Bad',owner_mode:true,phone:'01012345678',new_owner_venues:[{name:'Incomplete court'}]})]),/Required court information/);
 assert.equal((await db.query('SELECT count(*)::int n FROM profiles WHERE id=$1',[badId])).rows[0].n,0,'failed court prevents partial account/profile creation');
 await db.exec("SET test.role='authenticated'");await assert.rejects(db.query('SELECT reserve_court_signup_photo($1)',['a'.repeat(64)]),/Server upload permission/);await db.exec("SET test.role='service_role'");for(let i=0;i<20;i++)await db.query('SELECT reserve_court_signup_photo($1)',['a'.repeat(64)]);await assert.rejects(db.query('SELECT reserve_court_signup_photo($1)',['a'.repeat(64)]),/upload limit/);assert.equal((await db.query("SELECT has_function_privilege('anon','reserve_court_signup_photo(text)','EXECUTE') AS allowed")).rows[0].allowed,false);
 console.log('PASS: mandatory new court fields in client/database, malformed hours, legacy edits, owner and academy signup preserve contact/photos/per-court location/hours, atomic signup failure, migration rerun');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});

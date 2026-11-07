const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE TABLE venues(id uuid PRIMARY KEY,approval_status text);CREATE TABLE friendly_games(id uuid PRIMARY KEY,playground_id uuid,title text);GRANT SELECT,INSERT,UPDATE ON friendly_games TO authenticated;`);
 const approved=crypto.randomUUID(),pending=crypto.randomUUID(),rejected=crypto.randomUUID(),legacy=crypto.randomUUID();
 await db.query("INSERT INTO venues VALUES($1,'approved'),($2,'pending'),($3,'rejected')",[approved,pending,rejected]);
 await db.query("INSERT INTO friendly_games VALUES($1,NULL,'Existing game')",[legacy]);
 await db.exec(fs.readFileSync('supabase/migrations/20270123000000_games_require_listed_playground.sql','utf8'));
 await db.exec('SET ROLE authenticated');
 for(const venue of [null,crypto.randomUUID(),pending,rejected])await assert.rejects(db.query("INSERT INTO friendly_games VALUES($1,$2,'New game')",[crypto.randomUUID(),venue]),/playground listed on Playza/);
 const game=crypto.randomUUID();await db.query("INSERT INTO friendly_games VALUES($1,$2,'Listed venue')",[game,approved]);
 await assert.rejects(db.query('UPDATE friendly_games SET playground_id=NULL WHERE id=$1',[game]),/Select a playground/);
 await db.query("UPDATE friendly_games SET title='Updated legacy title',playground_id=playground_id WHERE id=$1",[legacy]);
 assert.equal((await db.query('SELECT playground_id FROM friendly_games WHERE id=$1',[legacy])).rows[0].playground_id,null);
 await db.exec('RESET ROLE');
 await assert.rejects(db.query("INSERT INTO friendly_games VALUES($1,NULL,'Privileged insert')",[crypto.randomUUID()]),/Select a playground/);
 await db.close();console.log('PASS: listed approved venues accepted; missing, unknown, pending and rejected venues blocked even for privileged inserts; legacy games retained');
})().catch(e=>{console.error(e);process.exit(1)});

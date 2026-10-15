import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/lib/games/participants.ts', 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { splitGameParticipants } = exports;
const rows = [
  { id:'paid', pay_status:'approved', is_waitlisted:false },
  { id:'checkout', pay_status:'unpaid', is_waitlisted:false },
  { id:'receipt', pay_status:'pending', is_waitlisted:false },
  { id:'declined', pay_status:'rejected', is_waitlisted:false },
  { id:'waitlist', pay_status:'unpaid', is_waitlisted:true },
  { id:'paid-waitlist', pay_status:'approved', is_waitlisted:true },
  { id:'unknown', pay_status:null, is_waitlisted:false },
  { id:'covered', pay_status:'approved', share_amount:0, is_waitlisted:false },
  { id:'guest', member_id:null, pay_status:'approved', is_waitlisted:false },
];
let groups = splitGameParticipants(rows);
assert.deepEqual(Array.from(groups.confirmed, p=>p.id), ['paid','covered','guest']);
assert.deepEqual(Array.from(groups.awaitingPayment,p=>p.id), ['checkout','receipt','declined','unknown']);
assert.deepEqual(Array.from(groups.waitlisted,p=>p.id), ['waitlist','paid-waitlist']);
assert.equal(groups.confirmed.length+groups.awaitingPayment.length+groups.waitlisted.length,rows.length);
const receipt = rows.find(p=>p.id==='receipt'); receipt.pay_status='approved';
groups=splitGameParticipants(rows);assert.ok(groups.confirmed.includes(receipt));assert.ok(!groups.awaitingPayment.includes(receipt));
receipt.pay_status='rejected';groups=splitGameParticipants(rows);assert.ok(!groups.confirmed.includes(receipt));
assert.equal(rows.length,9);assert.equal(splitGameParticipants([]).confirmed.length,0);
console.log('Participant confirmation checks passed: unpaid/pending/rejected excluded, waitlists separate, approvals update groups, free/guest approved places retained.');

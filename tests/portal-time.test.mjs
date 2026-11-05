import test from 'node:test';import assert from 'node:assert/strict';
import {montevideoInput,montevideoInstant} from '../lib/editorial/time.mjs';
test('editorial dates round trip across the UTC day boundary',()=>{
 assert.equal(montevideoInput('2026-11-04T01:30:00Z'),'2026-11-03T22:30');
 assert.equal(montevideoInstant('2026-11-03T22:30'),'2026-11-04T01:30:00.000Z');
 assert.equal(montevideoInstant(''),'');
 assert.throws(()=>montevideoInstant('2026-02-30T12:00'));
});

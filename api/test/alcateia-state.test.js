// Alcateia: the root key `alcateia` ({ quizDone, answers, at }) has no allowlist to pass and no
// merge of its own. PUT /api/data (stampPut) stores it, stamps it as a setting, and puts it back
// for a writer that does not know it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stampPut } from '../sync-stamps.js';

const clone = v => JSON.parse(JSON.stringify(v));
const quiz = { quizDone: true, answers: { goal: 'tone', place: 'home', days: 3, minutes: 30, level: 'beginner' }, at: 1000 };
const doc = extra => ({ _ts: 10, unit: 'kg', workouts: [], routines: [], ...extra });

test('a first push with the quiz stores it as it is', () => {
  const out = stampPut(doc(), doc({ alcateia: quiz }), { stamped: true, now: 20 });
  assert.deepEqual(out.alcateia, quiz);
});

test('an older app that does not know the field cannot wipe it', () => {
  const cur = doc({ alcateia: quiz, edited: { alcateia: 500 } });
  const out = stampPut(clone(cur), doc({ workouts: [{ id: 'w', d: '2026-10-10', entries: [] }] }), { stamped: false, overRead: true, now: 20 });
  assert.deepEqual(out.alcateia, quiz);
});

test('a change made by a writer that does not stamp is stamped as a setting', () => {
  const cur = doc({ alcateia: quiz });
  const next = doc({ alcateia: { ...quiz, answers: { ...quiz.answers, days: 2 }, at: 2000 } });
  const out = stampPut(clone(cur), next, { stamped: false, overRead: true, now: 20 });
  assert.equal(out.alcateia.answers.days, 2);
  assert.ok(out.edited.alcateia > 0);
});

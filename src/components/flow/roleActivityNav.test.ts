import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_ACTIVITIES } from './RoleActivityNav.tsx';
import type { UserRole } from '../../types/index.ts';

test('ROLE_ACTIVITIES covers all roles with valid sequences', () => {
  const roles: UserRole[] = ['bar', 'musico', 'espectador'];

  for (const role of roles) {
    const acts = ROLE_ACTIVITIES[role];
    assert.ok(acts, `Role ${role} must have defined activities`);
    assert.ok(acts.length >= 2, `Role ${role} must have at least 2 activities for navigation`);

    // Verify unique ids per role
    const ids = acts.map((a) => a.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, `Duplicate activity ids found in role ${role}`);

    // Verify all activities have title, description, emoji and gradient
    for (const act of acts) {
      assert.ok(act.title && act.title.length > 2, 'Activity must have a valid title');
      assert.ok(act.description && act.description.length > 5, 'Activity must have a description');
      assert.ok(act.emoji, 'Activity must have an emoji');
      assert.ok(act.icon, 'Activity must have a lucide icon');
      assert.ok(act.gradient, 'Activity must have a gradient style');
    }
  }
});

test('ROLE_ACTIVITIES forward and backward sequential order for Musician', () => {
  const musicoActivities = ROLE_ACTIVITIES.musico;

  // Starting at 0: convocatorias
  let currentIndex = 0;
  assert.strictEqual(musicoActivities[currentIndex].id, 'convocatorias');

  // Navigate forward to 1: acuerdos
  currentIndex++;
  assert.strictEqual(musicoActivities[currentIndex].id, 'acuerdos');

  // Navigate forward to 2: perfil
  currentIndex++;
  assert.strictEqual(musicoActivities[currentIndex].id, 'perfil');

  // Navigate backward to 1: acuerdos
  currentIndex--;
  assert.strictEqual(musicoActivities[currentIndex].id, 'acuerdos');

  // Navigate backward to 0: convocatorias
  currentIndex--;
  assert.strictEqual(musicoActivities[currentIndex].id, 'convocatorias');
  assert.strictEqual(currentIndex, 0);
});

test('Anfitrión bar activities cover open calls, agreements, and venue profile only', () => {
  const barActs = ROLE_ACTIVITIES.bar.map((a) => a.id);
  assert.deepStrictEqual(barActs, ['convocatorias', 'acuerdos', 'perfil']);
});

test('Público general activities strictly cover catalog and profile only', () => {
  const publicActs = ROLE_ACTIVITIES.espectador.map((a) => a.id);
  assert.deepStrictEqual(publicActs, ['cartelera', 'perfil']);
});

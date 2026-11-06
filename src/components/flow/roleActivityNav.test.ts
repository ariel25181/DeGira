import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_ACTIVITIES } from './RoleActivityNav.tsx';
import type { UserRole } from '../../types/index.ts';

test('ROLE_ACTIVITIES covers all roles with valid sequences', () => {
  const roles: UserRole[] = ['bar', 'musico', 'espectador'];

  for (const role of roles) {
    const acts = ROLE_ACTIVITIES[role];
    assert.ok(acts, `Role ${role} must have defined activities`);
    assert.ok(acts.length >= 3, `Role ${role} must have at least 3 activities for navigation`);

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

test('ROLE_ACTIVITIES forward and backward sequential order', () => {
  const musicoActivities = ROLE_ACTIVITIES.musico;

  // Starting at 0
  let currentIndex = 0;
  assert.strictEqual(musicoActivities[currentIndex].id, 'convocatorias');

  // Navigate forward
  currentIndex++;
  assert.strictEqual(musicoActivities[currentIndex].id, 'disponibilidad');

  // Navigate forward
  currentIndex++;
  assert.strictEqual(musicoActivities[currentIndex].id, 'reservas');

  // Navigate backward
  currentIndex--;
  assert.strictEqual(musicoActivities[currentIndex].id, 'disponibilidad');

  // Navigate backward to 0
  currentIndex--;
  assert.strictEqual(musicoActivities[currentIndex].id, 'convocatorias');
  assert.strictEqual(currentIndex, 0);
});

test('Anfitrión bar activities cover open calls, reservations, agreements, catalog and venue profile', () => {
  const barActs = ROLE_ACTIVITIES.bar.map((a) => a.id);
  assert.deepStrictEqual(barActs, ['convocatorias', 'reservas', 'acuerdos', 'cartelera', 'perfil']);
});

test('Público general activities cover catalog, reservations, venues and preferences', () => {
  const publicActs = ROLE_ACTIVITIES.espectador.map((a) => a.id);
  assert.deepStrictEqual(publicActs, ['cartelera', 'reservas', 'convocatorias', 'perfil']);
});

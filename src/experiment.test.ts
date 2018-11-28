import { experiment } from './experiment';

test('basic', () => {
  expect(experiment()).toBe(0);
});

test('basic again', () => {
  expect(experiment(1, 2)).toBe(3);
});

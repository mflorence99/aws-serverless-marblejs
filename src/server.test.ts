import { server } from './server';

test('basic', () => {
  expect(server()).toBe(0);
});

test('basic again', () => {
  expect(server(1, 2)).toBe(3);
});

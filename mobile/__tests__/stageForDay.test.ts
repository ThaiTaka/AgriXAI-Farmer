/**
 * Giai đoạn chăm sóc theo số ngày sau trồng (ADR 0009). The cases are shared
 * with backend/tests/test_stage_for_day.py so the phone and the web dashboard
 * agree on which tasks are pending.
 */

import fixture from '../../shared/test-fixtures/stage_for_day.json';
import {currentStage, protocolById, stageForDay} from '../src/domain/careProtocol';

const DAY = 86_400_000;

describe('stageForDay', () => {
  test.each(fixture.cases)('$protocol ngày $day → $stage', ({protocol, day, stage}) => {
    const found = protocolById(protocol);
    expect(found).toBeDefined();
    expect(stageForDay(found!, day)?.stage_code).toBe(stage);
  });

  test('a stage recorded on an open crop cycle wins over the planting date', () => {
    const tomato = protocolById('tomato_lamdong_2025')!;
    const planted = Date.UTC(2026, 7, 20);
    expect(currentStage(tomato, {plantedAt: planted, now: planted + 26 * DAY})?.stage_code).toBe('vegetative');
    expect(currentStage(tomato, {cycleStage: 'flowering', plantedAt: planted, now: planted + 26 * DAY})?.stage_code).toBe(
      'flowering',
    );
    expect(currentStage(tomato, {plantedAt: null})).toBeUndefined();
  });

  test('perennials follow the calendar month', () => {
    const robusta = protocolById('coffee_robusta_ctt_2010')!;
    expect(currentStage(robusta, {now: Date.UTC(2026, 0, 15)})?.stage_name_vi).toBe('Đợt 1 — giữa mùa khô');
  });
});

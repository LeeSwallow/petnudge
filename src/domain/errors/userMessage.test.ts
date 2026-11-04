import { describe, expect, it } from 'vitest';
import { toUserMessage } from './userMessage';

describe('user messages', () => {
  it('shows a domain error or a failed wire result as it is', () => {
    expect(toUserMessage({ code: 'not_found', message: '할 일을 찾지 못했어요' })).toEqual({ text: '할 일을 찾지 못했어요', detail: 'not_found' });
    expect(toUserMessage({ ok: false, error: { code: 'bad_input', message: '제목을 적어주세요' } })).toEqual({ text: '제목을 적어주세요', detail: 'bad_input' });
  });

  it('strips the IPC wrapper', () => {
    expect(toUserMessage(new Error("Error invoking remote method 'backup:import': Error: 파일이 비었어요")).text).toBe('파일이 비었어요');
    expect(toUserMessage(new Error('그냥 실패')).text).toBe('그냥 실패');
  });

  it('says something went wrong for anything else, keeping the value as detail', () => {
    expect(toUserMessage(undefined)).toEqual({ text: '문제가 생겼어요', detail: 'undefined' });
    expect(toUserMessage(new Error(''))).toEqual({ text: '문제가 생겼어요', detail: 'Error' });
    expect(toUserMessage('문자열 에러')).toEqual({ text: '문자열 에러', detail: '' });
  });
});

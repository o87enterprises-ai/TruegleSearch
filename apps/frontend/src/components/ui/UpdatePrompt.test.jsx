import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import UpdatePrompt from './UpdatePrompt';
import { findUpdate, isNewer } from '../../utils/apk';

const release = (tag) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: tag }) });

afterEach(() => { cleanup(); localStorage.clear(); delete window.Capacitor; vi.unstubAllGlobals(); });

describe('update check', () => {
  it('compares versions numerically', () => {
    expect(isNewer('0.2.10', '0.2.9')).toBe(true);
    expect(isNewer('0.2.4', '0.2.4')).toBe(false);
    expect(isNewer('0.2.3', '0.3')).toBe(false);
  });

  it('stays quiet when offline or on a foreign tag', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await findUpdate('0.2.3')).toBeNull();
    vi.stubGlobal('fetch', release('v9.9.9'));
    expect(await findUpdate('0.2.3')).toBeNull();
  });

  it('never asks outside the app', () => {
    const f = release('android-v9.0.0');
    vi.stubGlobal('fetch', f);
    render(<UpdatePrompt current="0.2.4" />);
    expect(f).not.toHaveBeenCalled();
  });

  it('offers a newer release in the app and remembers "not now"', async () => {
    window.Capacitor = { isNativePlatform: () => true };
    vi.stubGlobal('fetch', release('android-v0.2.5'));
    render(<UpdatePrompt current="0.2.4" />);
    expect(await screen.findByText(/Truegle 0\.2\.5 is available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(JSON.parse(localStorage.getItem('truegle_update_dismissed')).version).toBe('0.2.5');
  });
});
